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
      enforceScopeFilter: false,
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
      enforceScopeFilter: false,
    });

    expect(result.scannedQueued).toBe(1);
    expect(result.imported).toBe(1);
    expect(data.references).toHaveLength(1);
    expect(data.references[0].discoveryCandidateId).toBe('cand-a');
  });

  it('rejects out-of-scope candidates when scope filter is enabled', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    writeDiscoveryEvent(baseDir, fakeQueuedEvent({
      candidateId: 'cand-noise',
      query: 'methodological artifacts',
      title: 'Effects of error, chimera, bias on amplicon sequencing',
      abstract: 'microbial sequencing error and chimera artifacts in ecology',
      doi: '10.1000/noise',
    }));

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: DEFAULT_GOVERNANCE,
      auditEntries: [],
      runId: 'import-run-4',
      reviewStatus: 'draft',
      maxItems: 10,
      scopeKeywords: ['psi', 'ganzfeld', 'remote viewing'],
      excludeKeywords: ['microbial', 'sequencing'],
      minScopeScore: 2,
      enforceScopeFilter: true,
    });

    expect(result.imported).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.outOfScope).toBe(1);
    expect(data.references).toHaveLength(0);

    const rejected = listDiscoveryCandidates(baseDir, { status: 'rejected', runId: 'import-run-4' });
    expect(rejected).toHaveLength(1);
    expect(rejected[0].decisionReason?.includes('out-of-scope-auto-filter')).toBe(true);
  });

  it('creates a new node when auto node growth is enabled and confidence is high', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld',
      description: 'Ganzfeld studies',
      categoryId: 'general',
      keywords: ['ganzfeld', 'telepathy'],
      type: 0,
      trust: 0.6,
      referenceIds: [],
    });
    writeDiscoveryEvent(baseDir, fakeQueuedEvent({
      candidateId: 'cand-node-create',
      title: 'Ganzfeld telepathy signal reliability analysis',
      query: 'ganzfeld telepathy psi',
      doi: '10.1000/node-create',
    }));

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: DEFAULT_GOVERNANCE,
      auditEntries: [],
      runId: 'import-run-5',
      reviewStatus: 'draft',
      maxItems: 10,
      scopeKeywords: ['psi', 'ganzfeld', 'telepathy'],
      minScopeScore: 2,
      enforceScopeFilter: true,
      autoNodeGrowth: true,
      maxNewNodes: 2,
      minNodeConfidence: 0.55,
    });

    expect(result.imported).toBe(1);
    expect(result.nodesProposed).toBe(1);
    expect(result.nodesCreated).toBe(1);
    expect(result.createdNodeIds).toHaveLength(1);
    const created = data.nodes.find((node) => node.id === result.createdNodeIds[0]);
    expect(created).toBeDefined();
    expect(created?.reviewStatus).toBe('approved');
    expect(created?.referenceIds).toContain(result.importedRefIds[0]);
    expect(result.nodeDetails[0].decision).toBe('created');
  });

  it('uses weak-scope fallback and skips node growth when confidence stays below threshold', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld',
      description: 'Ganzfeld studies',
      categoryId: 'general',
      keywords: ['ganzfeld', 'telepathy'],
      type: 0,
      trust: 0.6,
      referenceIds: [],
    });
    writeDiscoveryEvent(baseDir, fakeQueuedEvent({
      candidateId: 'cand-node-low-conf',
      title: 'Methodological factors in replication pipelines',
      query: 'replication signal',
      abstract: 'general research methodology and replication concerns',
      doi: '10.1000/node-low-conf',
    }));

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: DEFAULT_GOVERNANCE,
      auditEntries: [],
      runId: 'import-run-6',
      reviewStatus: 'draft',
      maxItems: 10,
      scopeKeywords: ['psi', 'ganzfeld', 'remote viewing'],
      minScopeScore: 3,
      enforceScopeFilter: false,
      autoNodeGrowth: true,
      maxNewNodes: 2,
      minNodeConfidence: 0.9,
    });

    expect(result.imported).toBe(1);
    expect(result.nodesProposed).toBe(1);
    expect(result.nodesCreated).toBe(0);
    expect(result.skipReasons.some((reason) => reason.code === 'low-node-confidence')).toBe(true);
    expect(result.nodeDetails[0].decision).toBe('skipped');
  });

  it('marks node growth as duplicate when proposed name matches existing node', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Meta-analysis of psi ganzfeld research',
      description: 'Existing node',
      categoryId: 'general',
      keywords: ['ganzfeld', 'meta analysis'],
      type: 0,
      trust: 0.6,
      referenceIds: [],
    });
    writeDiscoveryEvent(baseDir, fakeQueuedEvent({
      candidateId: 'cand-node-dup',
      title: 'Meta-analysis of psi ganzfeld research',
      query: 'psi ganzfeld meta-analysis',
      doi: '10.1000/node-dup',
    }));

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: DEFAULT_GOVERNANCE,
      auditEntries: [],
      runId: 'import-run-7',
      reviewStatus: 'draft',
      maxItems: 10,
      scopeKeywords: ['psi', 'ganzfeld'],
      enforceScopeFilter: false,
      autoNodeGrowth: true,
      maxNewNodes: 2,
      minNodeConfidence: 0.5,
    });

    expect(result.imported).toBe(1);
    expect(result.nodesCreated).toBe(0);
    expect(result.nodeDuplicates).toBe(1);
    expect(result.skipReasons.some((reason) => reason.code === 'node-duplicate')).toBe(true);
    expect(result.nodeDetails[0].decision).toBe('duplicate');
  });

  it('rejects node growth when governance daily cap is exceeded', () => {
    const baseDir = createDir();
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld',
      description: 'Ganzfeld studies',
      categoryId: 'general',
      keywords: ['ganzfeld', 'telepathy'],
      type: 0,
      trust: 0.6,
      referenceIds: [],
    });
    writeDiscoveryEvent(baseDir, fakeQueuedEvent({
      candidateId: 'cand-node-cap',
      title: 'Ganzfeld telepathy signal reliability analysis',
      query: 'ganzfeld telepathy psi',
      doi: '10.1000/node-cap',
    }));

    const result = importQueuedDiscoveryCandidates({
      baseDir,
      data,
      governanceConfig: {
        ...DEFAULT_GOVERNANCE,
        maxDailyNewNodes: 0,
      },
      auditEntries: [],
      runId: 'import-run-8',
      reviewStatus: 'draft',
      maxItems: 10,
      scopeKeywords: ['psi', 'ganzfeld', 'telepathy'],
      enforceScopeFilter: false,
      autoNodeGrowth: true,
      maxNewNodes: 2,
      minNodeConfidence: 0.5,
    });

    expect(result.imported).toBe(1);
    expect(result.nodesCreated).toBe(0);
    expect(result.nodeRejected).toBe(1);
    expect(result.skipReasons.some((reason) => reason.code === 'node-governance-rejected')).toBe(true);
    expect(result.nodeDetails[0].decision).toBe('rejected');
  });
});
