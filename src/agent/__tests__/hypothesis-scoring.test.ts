import { describe, expect, it } from 'vitest';
import type { HypothesisCard } from '../../domain/types';
import { computeHypothesisScore, triageHypotheses } from '../hypothesis-scoring';

function fakeHypothesis(overrides: Partial<HypothesisCard>): HypothesisCard {
  return {
    id: 'hyp-1',
    statement: 'Test hypothesis',
    linkedNodeIds: [],
    supportRefIds: [],
    contradictRefIds: [],
    constraintEdgeIds: [],
    score: 0,
    status: 'draft',
    createdAt: '2026-02-18T10:00:00.000Z',
    ...overrides,
  };
}

describe('hypothesis scoring', () => {
  it('assigns higher scores to stronger support and lower contradiction', () => {
    const weak = fakeHypothesis({ supportRefIds: ['r1'], contradictRefIds: ['c1', 'c2'] });
    const strong = fakeHypothesis({
      id: 'hyp-2',
      supportRefIds: ['r1', 'r2', 'r3', 'r4'],
      contradictRefIds: [],
      linkedNodeIds: ['P2', 'P3'],
      constraintEdgeIds: ['E1'],
    });

    const weakScore = computeHypothesisScore(weak).score;
    const strongScore = computeHypothesisScore(strong).score;
    expect(strongScore).toBeGreaterThan(weakScore);
  });

  it('triages top cards and promotes selected drafts to pending-review', () => {
    const hypotheses: HypothesisCard[] = [
      fakeHypothesis({ id: 'hyp-1', supportRefIds: ['r1', 'r2', 'r3'], status: 'draft' }),
      fakeHypothesis({ id: 'hyp-2', supportRefIds: ['r1'], contradictRefIds: ['c1'], status: 'draft' }),
      fakeHypothesis({ id: 'hyp-3', supportRefIds: ['r1', 'r2', 'r3', 'r4'], status: 'approved' }),
    ];

    const triaged = triageHypotheses(hypotheses, {
      top: 2,
      minScore: 0.3,
      promote: true,
      nowIso: '2026-02-18T12:00:00.000Z',
    });

    expect(triaged.selected.length).toBe(2);
    expect(triaged.promoted).toBe(1);
    expect(Object.keys(triaged.scoreBreakdowns)).toEqual(expect.arrayContaining(['hyp-1', 'hyp-2', 'hyp-3']));

    const hyp1 = triaged.updatedHypotheses.find((h) => h.id === 'hyp-1');
    const hyp3 = triaged.updatedHypotheses.find((h) => h.id === 'hyp-3');
    expect(hyp1?.status).toBe('pending-review');
    expect(hyp3?.status).toBe('approved');
  });
});
