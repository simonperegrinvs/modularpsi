import { describe, expect, it } from 'vitest';
import { isConstraintEdge, isConstraintEdgeType } from '../constraints';
import {
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_DERIVATION,
  EDGE_TYPE_FAILS_WHEN,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_REQUIRES,
} from '../types';

describe('constraint edge helpers', () => {
  it('identifies constraint edge types', () => {
    expect(isConstraintEdgeType(EDGE_TYPE_REQUIRES)).toBe(true);
    expect(isConstraintEdgeType(EDGE_TYPE_CONFOUNDED_BY)).toBe(true);
    expect(isConstraintEdgeType(EDGE_TYPE_INCOMPATIBLE_WITH)).toBe(true);
    expect(isConstraintEdgeType(EDGE_TYPE_FAILS_WHEN)).toBe(true);
    expect(isConstraintEdgeType(EDGE_TYPE_DERIVATION)).toBe(false);
  });

  it('identifies constraint edges by edge object', () => {
    expect(isConstraintEdge({
      id: 'e1',
      sourceId: 'P1',
      targetId: 'P2',
      trust: 0.5,
      type: EDGE_TYPE_REQUIRES,
      combinedTrust: 0.5,
    })).toBe(true);
  });
});
