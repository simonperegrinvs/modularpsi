import { describe, expect, it } from 'vitest';
import { createHypothesis, nextHypothesisId } from '../hypothesis';

describe('hypothesis helpers', () => {
  it('generates sequential hypothesis IDs', () => {
    expect(nextHypothesisId([])).toBe('hyp-1');
    expect(nextHypothesisId([
      {
        id: 'hyp-2',
        statement: '',
        linkedNodeIds: [],
        supportRefIds: [],
        contradictRefIds: [],
        constraintEdgeIds: [],
        score: 0,
        status: 'draft',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'hyp-10',
        statement: '',
        linkedNodeIds: [],
        supportRefIds: [],
        contradictRefIds: [],
        constraintEdgeIds: [],
        score: 0,
        status: 'draft',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])).toBe('hyp-11');
  });

  it('creates normalized hypothesis cards with deduplicated link arrays', () => {
    const created = createHypothesis([], {
      statement: '  Candidate mechanism explains cross-lab effect  ',
      linkedNodeIds: ['P2', 'P2', 'P3'],
      supportRefIds: ['ref-1', 'ref-1'],
      contradictRefIds: ['ref-2'],
      constraintEdgeIds: ['E1', 'E1'],
      score: 0.67,
      status: 'pending-review',
      createdByRunId: 'run-22',
      nowIso: '2026-02-18T10:00:00.000Z',
    });

    expect(created.id).toBe('hyp-1');
    expect(created.statement).toBe('Candidate mechanism explains cross-lab effect');
    expect(created.linkedNodeIds).toEqual(['P2', 'P3']);
    expect(created.supportRefIds).toEqual(['ref-1']);
    expect(created.constraintEdgeIds).toEqual(['E1']);
    expect(created.status).toBe('pending-review');
    expect(created.createdByRunId).toBe('run-22');
  });
});
