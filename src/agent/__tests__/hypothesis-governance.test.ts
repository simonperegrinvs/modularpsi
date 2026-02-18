import { describe, expect, it } from 'vitest';
import { DEFAULT_GOVERNANCE } from '../governance';
import {
  checkDailyConstraintEdgeCap,
  checkDailyHypothesisCap,
  validateHypothesesForGovernance,
} from '../hypothesis-governance';
import { EDGE_TYPE_REQUIRES, EDGE_TYPE_IMPLICATION } from '../../domain/types';

describe('hypothesis governance', () => {
  it('validates required hypothesis evidence and duplicate statements', () => {
    const config = { ...DEFAULT_GOVERNANCE, requireHypothesisEvidence: true, duplicateRejection: true };
    const refs = [
      {
        id: 'ref-1',
        title: 'R1',
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
      },
    ];
    const hypotheses = [
      {
        id: 'hyp-1',
        statement: 'A hypothesis',
        linkedNodeIds: ['P2'],
        supportRefIds: [],
        contradictRefIds: [],
        constraintEdgeIds: [],
        score: 0,
        status: 'draft' as const,
        createdAt: '2026-02-18T10:00:00.000Z',
      },
      {
        id: 'hyp-2',
        statement: 'A hypothesis',
        linkedNodeIds: ['P3'],
        supportRefIds: ['ref-1'],
        contradictRefIds: [],
        constraintEdgeIds: [],
        score: 0,
        status: 'draft' as const,
        createdAt: '2026-02-18T10:00:00.000Z',
      },
    ];

    const result = validateHypothesesForGovernance(hypotheses, refs, config);
    expect(result.errors.some((e) => e.includes('requires at least one supporting reference'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Duplicate hypothesis statements'))).toBe(true);
  });

  it('enforces daily caps for hypotheses and constraint edges', () => {
    const today = new Date().toISOString().slice(0, 10);
    const hypoCap = checkDailyHypothesisCap([
      {
        id: 'hyp-1',
        statement: 'A',
        linkedNodeIds: [],
        supportRefIds: ['ref-1'],
        contradictRefIds: [],
        constraintEdgeIds: [],
        score: 0.5,
        status: 'draft',
        createdAt: `${today}T10:00:00.000Z`,
      },
    ], 1);
    expect(hypoCap.withinCap).toBe(false);

    const edgeCap = checkDailyConstraintEdgeCap([
      {
        id: 'e1',
        sourceId: 'P1',
        targetId: 'P2',
        trust: 0.5,
        type: EDGE_TYPE_REQUIRES,
        combinedTrust: 0.5,
        provenance: { source: 'agent', timestamp: `${today}T11:00:00.000Z` },
      },
      {
        id: 'e2',
        sourceId: 'P1',
        targetId: 'P3',
        trust: 0.5,
        type: EDGE_TYPE_IMPLICATION,
        combinedTrust: 0.5,
        provenance: { source: 'agent', timestamp: `${today}T11:00:00.000Z` },
      },
    ], 1);
    expect(edgeCap.withinCap).toBe(false);
    expect(edgeCap.todayCount).toBe(1);
  });
});
