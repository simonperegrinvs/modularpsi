import { describe, expect, it } from 'vitest';
import { edgeDashPattern } from '../edge-style';
import {
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_DERIVATION,
  EDGE_TYPE_FAILS_WHEN,
  EDGE_TYPE_IMPLICATION,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_POSSIBILITY,
  EDGE_TYPE_REQUIRES,
} from '../../../domain/types';

describe('edgeDashPattern', () => {
  it('returns expected dash patterns for legacy edge types', () => {
    expect(edgeDashPattern(EDGE_TYPE_IMPLICATION)).toBeUndefined();
    expect(edgeDashPattern(EDGE_TYPE_DERIVATION)).toBe('8 4 2 4');
    expect(edgeDashPattern(EDGE_TYPE_POSSIBILITY)).toBe('6 4');
  });

  it('returns distinct dash patterns for constraint edge types', () => {
    expect(edgeDashPattern(EDGE_TYPE_REQUIRES)).toBe('10 3');
    expect(edgeDashPattern(EDGE_TYPE_CONFOUNDED_BY)).toBe('2 4');
    expect(edgeDashPattern(EDGE_TYPE_INCOMPATIBLE_WITH)).toBe('10 3 2 3');
    expect(edgeDashPattern(EDGE_TYPE_FAILS_WHEN)).toBe('1 3');
  });
});
