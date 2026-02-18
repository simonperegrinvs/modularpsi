import { describe, expect, it } from 'vitest';
import { createEmptyGraph } from '../../io/json-io';
import { summarizeHypothesisContradictions, summarizeNodeContradictions } from '../contradictions';

describe('contradiction summaries', () => {
  it('marks nodes as mixed when linked claims support and contradict', () => {
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
            text: 'Significant effect',
            direction: 'supports',
            contextTags: [],
            confidence: 0.8,
            rationale: '',
            extractorModel: 'test',
            createdAt: '2026-02-18T10:00:00.000Z',
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
            text: 'No significant effect',
            direction: 'contradicts',
            contextTags: [],
            confidence: 0.8,
            rationale: '',
            extractorModel: 'test',
            createdAt: '2026-02-18T10:00:00.000Z',
          },
        ],
      },
    );

    const summary = summarizeNodeContradictions(data);
    const node = summary.find((x) => x.nodeId === 'P2');
    expect(node?.status).toBe('mixed');
    expect(node?.supportClaims).toBe(1);
    expect(node?.contradictClaims).toBe(1);
  });

  it('marks hypotheses with both support and contradict refs as mixed', () => {
    const summary = summarizeHypothesisContradictions([
      {
        id: 'hyp-1',
        statement: 'Test',
        linkedNodeIds: ['P2'],
        supportRefIds: ['ref-1'],
        contradictRefIds: ['ref-9'],
        constraintEdgeIds: [],
        score: 0.5,
        status: 'draft',
        createdAt: '2026-02-18T10:00:00.000Z',
      },
    ]);
    expect(summary[0].status).toBe('mixed');
  });
});
