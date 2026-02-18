import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createEmptyGraph } from '../../io/json-io';
import type { AgentConfig } from '../config';
import type { AgentState } from '../state';
import { listDiscoveryCandidates } from '../discovery';
import { buildDiscoveryQueries, runDiscoveryIngestion } from '../discovery-run';

const baseConfig: AgentConfig = {
  searchApis: ['semantic-scholar', 'openalex'],
  maxResultsPerQuery: 5,
  maxQueriesPerRun: 10,
  maxNewNodesPerRun: 5,
  maxNewRefsPerRun: 20,
  citationSnowballsPerRun: 25,
  defaultReviewStatus: 'draft',
  yearRange: [1970, 2026],
  focusKeywords: ['remote viewing'],
  excludeKeywords: [],
  rateLimitMs: 0,
};

const baseState: AgentState = {
  lastRunTimestamp: '',
  lastRunId: '',
  totalRuns: 0,
  recentSearchQueries: [],
  searchCursors: {},
  processedCandidateIds: [],
  lastCursorByQueryApi: {},
  lastDiscoveryRunId: '',
  discoveryStats: {
    queued: 0,
    parsed: 0,
    imported: 0,
    duplicate: 0,
    rejected: 0,
  },
};

describe('discovery-run', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function createDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'mpsi-discovery-run-'));
    dirs.push(dir);
    return dir;
  }

  it('builds query lanes from graph gaps and focus keywords', () => {
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld Signal',
      description: 'missing refs',
      categoryId: 'general',
      keywords: ['ganzfeld', 'telepathy'],
      type: 0,
      trust: 0.7,
      referenceIds: [],
    });

    const queries = buildDiscoveryQueries(data, baseConfig, 5);
    expect(queries[0]).toContain('Ganzfeld Signal');
    expect(queries.join(' | ')).toContain('remote viewing psi');
  });

  it('writes discovery events and updates state with processed candidate IDs', async () => {
    const baseDir = createDir();
    const data = createEmptyGraph();

    const result = await runDiscoveryIngestion({
      baseDir,
      data,
      references: [
        {
          id: 'ref-existing',
          title: 'Known',
          authors: ['A'],
          year: 2024,
          publication: '',
          publisher: '',
          citation: '',
          pageStart: 0,
          pageEnd: 0,
          volume: 0,
          description: '',
          doi: '10.1000/dup',
          url: '',
          semanticScholarId: '',
          openAlexId: '',
          abstract: '',
        },
      ],
      config: baseConfig,
      state: baseState,
      queries: ['ganzfeld psi'],
      apis: ['semantic-scholar'],
      runId: 'run-test-1',
      searchFn: async () => [
        {
          title: 'Duplicate DOI Paper',
          authors: ['A'],
          year: 2024,
          doi: '10.1000/dup',
          source: 'semantic-scholar',
        },
        {
          title: 'Novel Paper',
          authors: ['B'],
          year: 2025,
          semanticScholarId: 'S2-NEW-1',
          abstract: 'A novel abstract',
          source: 'semantic-scholar',
        },
      ],
    });

    expect(result.eventsWritten).toBe(2);
    expect(result.byDecision.duplicate).toBe(1);
    expect(result.byDecision.queued).toBe(1);
    expect(result.nextState.lastDiscoveryRunId).toBe('run-test-1');
    expect(result.nextState.totalRuns).toBe(1);
    expect(result.nextState.processedCandidateIds.some((id) => id.includes('S2-NEW-1'))).toBe(true);

    const listed = listDiscoveryCandidates(baseDir, {});
    expect(listed).toHaveLength(2);
  });

  it('marks already-processed candidates as duplicates on later runs', async () => {
    const baseDir = createDir();
    const state = {
      ...baseState,
      processedCandidateIds: ['s2:S2-OLD-1'],
    };
    const data = createEmptyGraph();

    const result = await runDiscoveryIngestion({
      baseDir,
      data,
      references: [],
      config: baseConfig,
      state,
      queries: ['precognition'],
      apis: ['openalex'],
      runId: 'run-test-2',
      searchFn: async () => [
        {
          title: 'Seen Before',
          authors: ['C'],
          year: 2020,
          semanticScholarId: 'S2-OLD-1',
          source: 'openalex',
        },
      ],
    });

    expect(result.byDecision.duplicate).toBe(1);
    const listed = listDiscoveryCandidates(baseDir, { status: 'duplicate' });
    expect(listed).toHaveLength(1);
    expect(listed[0].decisionReason).toBe('already-processed-candidate-id');
  });
});
