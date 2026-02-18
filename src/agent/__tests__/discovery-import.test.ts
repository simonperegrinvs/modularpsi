import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createEmptyGraph } from '../../io/json-io';
import { DEFAULT_GOVERNANCE } from '../governance';
import { listDiscoveryCandidates, writeDiscoveryEvent, type DiscoveryEvent } from '../discovery';
import { importQueuedDiscoveryCandidates } from '../discovery-import';

function fakeQueuedEvent(overrides: Partial<DiscoveryEvent> = {}): DiscoveryEvent {
  return {
    timestamp: '2026-02-18T10:00:00.000Z',
    action: 'discover',
    candidateId: 'cand-1',
    source: 'semantic-scholar',
    discoveredAt: '2026-02-18T10:00:00.000Z',
    query: 'psi ganzfeld',
    title: 'Meta-analysis of psi ganzfeld research',
    authors: ['C. Honorton'],
    year: 1985,
    doi: '10.1000/ganzfeld',
    url: 'https://example.org/ganzfeld',
    semanticScholarId: 'S2-GANZFELD',
    decision: 'queued',
    runId: 'run-a',
    ...overrides,
  };
}

describe('discovery-import', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function createDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'mpsi-discovery-import-'));
    dirs.push(dir);
    return dir;
  }

  it('imports queued candidates as draft references and updates candidate decision', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld',
      description: 'Ganzfeld node',
      categoryId: 'general',
      keywords: ['ganzfeld', 'telepathy'],
      type: 0,
      trust: 0.6,
      referenceIds: [],
    });
    writeDiscoveryEvent(baseDir, fakeQueuedEvent());

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: DEFAULT_GOVERNANCE,
      auditEntries: [],
      runId: 'import-run-1',
      sourceRunId: 'run-a',
      reviewStatus: 'draft',
      maxItems: 10,
      maxLinkedNodes: 2,
    });

    expect(result.imported).toBe(1);
    expect(data.references).toHaveLength(1);
    expect(data.references[0].processingStatus).toBe('imported-draft');
    expect(data.nodes.find((n) => n.id === 'P2')?.referenceIds).toContain(data.references[0].id);

    const imported = listDiscoveryCandidates(baseDir, { status: 'imported-draft', runId: 'import-run-1' });
    expect(imported).toHaveLength(1);
    expect(imported[0].candidateId).toBe('cand-1');
  });

  it('marks queued candidate as duplicate when publish gate rejects it as duplicate', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    data.references.push({
      id: 'ref-existing',
      title: 'Existing',
      authors: ['A'],
      year: 2024,
      publication: '',
      publisher: '',
      citation: '',
      pageStart: 0,
      pageEnd: 0,
      volume: 0,
      description: '',
      doi: '10.1000/ganzfeld',
      url: '',
      semanticScholarId: '',
      openAlexId: '',
      abstract: '',
    });
    writeDiscoveryEvent(baseDir, fakeQueuedEvent());

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: DEFAULT_GOVERNANCE,
      auditEntries: [],
      runId: 'import-run-2',
      reviewStatus: 'draft',
      maxItems: 10,
    });

    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(1);
    const dupes = listDiscoveryCandidates(baseDir, { status: 'duplicate', runId: 'import-run-2' });
    expect(dupes).toHaveLength(1);
    expect(data.references).toHaveLength(1);
  });

  it('respects sourceRunId filter so only candidates from the selected run are imported', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    writeDiscoveryEvent(baseDir, fakeQueuedEvent({ candidateId: 'cand-a', runId: 'run-a' }));
    writeDiscoveryEvent(baseDir, fakeQueuedEvent({ candidateId: 'cand-b', runId: 'run-b', doi: '10.1000/other' }));

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: DEFAULT_GOVERNANCE,
      auditEntries: [],
      runId: 'import-run-3',
      sourceRunId: 'run-a',
      reviewStatus: 'draft',
      maxItems: 10,
    });

    expect(result.scannedQueued).toBe(1);
    expect(result.imported).toBe(1);
    expect(data.references).toHaveLength(1);
    expect(data.references[0].discoveryCandidateId).toBe('cand-a');
  });
});
