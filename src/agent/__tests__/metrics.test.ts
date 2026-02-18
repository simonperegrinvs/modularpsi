import { describe, expect, it } from 'vitest';
import { createEmptyGraph } from '../../io/json-io';
import type { DiscoveryEvent } from '../discovery';
import { buildMetricsReport } from '../metrics';

describe('metrics report', () => {
  it('computes precision/novelty/stability and throughput proxies', () => {
    const data = createEmptyGraph();
    data.nodes.push(
      {
        id: 'P2',
        name: 'N1',
        description: '',
        categoryId: 'general',
        keywords: [],
        type: 0,
        trust: 0.5,
        referenceIds: [],
      },
      {
        id: 'P3',
        name: 'N2',
        description: '',
        categoryId: 'bio',
        keywords: [],
        type: 0,
        trust: 0.5,
        referenceIds: [],
      },
    );
    data.references.push({
      id: 'ref-1',
      title: 'R',
      authors: [],
      year: 2024,
      publication: '',
      publisher: '',
      citation: '',
      pageStart: 0,
      pageEnd: 0,
      volume: 0,
      description: '',
      doi: '',
      url: '',
      semanticScholarId: '',
      openAlexId: '',
      abstract: '',
      reviewStatus: 'draft',
      processingStatus: 'imported-draft',
    });
    data.hypotheses.push(
      {
        id: 'hyp-1',
        statement: 'Cross-category approved',
        linkedNodeIds: ['P2', 'P3'],
        supportRefIds: ['ref-1'],
        contradictRefIds: [],
        constraintEdgeIds: [],
        score: 0.8,
        status: 'approved',
        createdAt: '2025-12-15T00:00:00.000Z',
      },
      {
        id: 'hyp-2',
        statement: 'Rejected hypothesis',
        linkedNodeIds: ['P2'],
        supportRefIds: ['ref-1'],
        contradictRefIds: ['ref-x'],
        constraintEdgeIds: [],
        score: 0.2,
        status: 'rejected',
        createdAt: '2026-02-15T00:00:00.000Z',
      },
    );

    const events: DiscoveryEvent[] = [
      {
        timestamp: '2026-02-16T12:00:00.000Z',
        action: 'discover',
        candidateId: 'cand-1',
        source: 'semantic-scholar',
        discoveredAt: '2026-02-16T12:00:00.000Z',
        query: 'q',
        title: 'T',
        authors: [],
        year: 2024,
        decision: 'queued',
        runId: 'run',
      },
      {
        timestamp: '2026-02-17T12:00:00.000Z',
        action: 'decision-update',
        candidateId: 'cand-1',
        source: 'semantic-scholar',
        discoveredAt: '2026-02-16T12:00:00.000Z',
        query: 'q',
        title: 'T',
        authors: [],
        year: 2024,
        decision: 'duplicate',
        runId: 'run',
      },
    ];

    const report = buildMetricsReport(data, events, 'weekly', '2026-02-18T00:00:00.000Z');
    expect(report.period).toBe('weekly');
    expect(report.throughput.discoveryEvents).toBe(2);
    expect(report.throughput.candidates).toBe(1);
    expect(report.precisionProxy).toBeGreaterThanOrEqual(0);
    expect(report.noveltyProxy).toBe(1);
    expect(report.reviewFlow.draftRefs).toBe(1);
  });
});
