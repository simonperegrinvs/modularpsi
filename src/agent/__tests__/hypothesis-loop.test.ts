import { describe, expect, it } from 'vitest';
import { createEmptyGraph } from '../../io/json-io';
import { runHypothesisLoop } from '../hypothesis-loop';

describe('hypothesis loop (generator/skeptic/judge)', () => {
  it('proposes hypotheses from claim-backed references', () => {
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld',
      description: '',
      categoryId: 'general',
      keywords: [],
      type: 0,
      trust: 0.7,
      referenceIds: ['ref-1', 'ref-2'],
    });
    data.references.push(
      {
        id: 'ref-1',
        title: 'Support',
        authors: [],
        year: 2020,
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
        claims: [
          {
            claimId: 'c1',
            text: 'Significant effect observed',
            direction: 'supports',
            contextTags: ['phenomenon'],
            confidence: 0.8,
            rationale: '',
            extractorModel: 'test',
            createdAt: '2026-02-18T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'ref-2',
        title: 'Contradiction',
        authors: [],
        year: 2021,
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
        claims: [
          {
            claimId: 'c2',
            text: 'No significant effect in replication',
            direction: 'contradicts',
            contextTags: ['failure-mode'],
            confidence: 0.8,
            rationale: '',
            extractorModel: 'test',
            createdAt: '2026-02-18T00:00:00.000Z',
          },
        ],
      },
    );

    const result = runHypothesisLoop(data, { top: 3, runId: 'run-loop-1', nowIso: '2026-02-18T10:00:00.000Z' });
    expect(result.accepted.length).toBe(1);
    expect(result.accepted[0].linkedNodeIds).toEqual(['P2']);
    expect(result.accepted[0].supportRefIds).toContain('ref-1');
    expect(result.accepted[0].contradictRefIds).toContain('ref-2');
    expect(result.accepted[0].status).toBe('draft');
  });

  it('rejects candidates with no supporting references', () => {
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Only Contradiction',
      description: '',
      categoryId: 'general',
      keywords: [],
      type: 0,
      trust: 0.3,
      referenceIds: ['ref-1'],
    });
    data.references.push({
      id: 'ref-1',
      title: 'Only Contradiction',
      authors: [],
      year: 2021,
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
      claims: [
        {
          claimId: 'c1',
          text: 'No effect',
          direction: 'contradicts',
          contextTags: [],
          confidence: 0.8,
          rationale: '',
          extractorModel: 'test',
          createdAt: '2026-02-18T00:00:00.000Z',
        },
      ],
    });

    const result = runHypothesisLoop(data, { top: 3 });
    expect(result.accepted.length).toBe(0);
    expect(result.rejected.some((r) => r.reason === 'insufficient-support')).toBe(true);
  });
});
