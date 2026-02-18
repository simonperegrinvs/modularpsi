import { describe, it, expect } from 'vitest';
import {
  trustItem2float,
  float2TrustItem,
  parseNodeType,
  parseEdgeType,
  NODE_TYPE_REGULAR,
  NODE_TYPE_CHOOSER,
  NODE_TYPE_HOLDER,
  EDGE_TYPE_IMPLICATION,
  EDGE_TYPE_DERIVATION,
  EDGE_TYPE_POSSIBILITY,
  EDGE_TYPE_REQUIRES,
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_FAILS_WHEN,
} from '../types';

describe('trustItem2float', () => {
  it('maps items 0-6 to expected floats', () => {
    expect(trustItem2float(0)).toBe(-1);
    expect(trustItem2float(1)).toBe(0);
    expect(trustItem2float(2)).toBeCloseTo(0.2);
    expect(trustItem2float(3)).toBeCloseTo(0.4);
    expect(trustItem2float(4)).toBeCloseTo(0.6);
    expect(trustItem2float(5)).toBeCloseTo(0.8);
    expect(trustItem2float(6)).toBe(1.0);
  });
});

describe('float2TrustItem', () => {
  it('maps floats back to items', () => {
    expect(float2TrustItem(-1)).toBe(0);
    expect(float2TrustItem(0)).toBe(1);
    expect(float2TrustItem(0.2)).toBe(2);
    expect(float2TrustItem(0.4)).toBe(3);
    expect(float2TrustItem(0.6)).toBe(4);
    expect(float2TrustItem(0.8)).toBe(5);
    expect(float2TrustItem(1.0)).toBe(6);
  });

  it('round-trips with trustItem2float for items 1-6', () => {
    for (let i = 1; i <= 6; i++) {
      expect(float2TrustItem(trustItem2float(i))).toBe(i);
    }
  });

  it('round-trips item 0 (unclassified)', () => {
    expect(float2TrustItem(trustItem2float(0))).toBe(0);
  });
});

describe('parseNodeType', () => {
  it('parses string labels', () => {
    expect(parseNodeType('regular')).toBe(NODE_TYPE_REGULAR);
    expect(parseNodeType('chooser')).toBe(NODE_TYPE_CHOOSER);
    expect(parseNodeType('holder')).toBe(NODE_TYPE_HOLDER);
  });

  it('parses numeric strings', () => {
    expect(parseNodeType('0')).toBe(NODE_TYPE_REGULAR);
    expect(parseNodeType('1')).toBe(NODE_TYPE_CHOOSER);
    expect(parseNodeType('2')).toBe(NODE_TYPE_HOLDER);
  });

  it('is case-insensitive', () => {
    expect(parseNodeType('CHOOSER')).toBe(NODE_TYPE_CHOOSER);
    expect(parseNodeType('Holder')).toBe(NODE_TYPE_HOLDER);
  });

  it('defaults to regular for unknown input', () => {
    expect(parseNodeType('unknown')).toBe(NODE_TYPE_REGULAR);
    expect(parseNodeType('')).toBe(NODE_TYPE_REGULAR);
  });
});

describe('parseEdgeType', () => {
  it('parses string labels', () => {
    expect(parseEdgeType('implication')).toBe(EDGE_TYPE_IMPLICATION);
    expect(parseEdgeType('derivation')).toBe(EDGE_TYPE_DERIVATION);
    expect(parseEdgeType('possibility')).toBe(EDGE_TYPE_POSSIBILITY);
    expect(parseEdgeType('requires')).toBe(EDGE_TYPE_REQUIRES);
    expect(parseEdgeType('confounded-by')).toBe(EDGE_TYPE_CONFOUNDED_BY);
    expect(parseEdgeType('incompatible-with')).toBe(EDGE_TYPE_INCOMPATIBLE_WITH);
    expect(parseEdgeType('fails-when')).toBe(EDGE_TYPE_FAILS_WHEN);
  });

  it('parses numeric strings', () => {
    expect(parseEdgeType('0')).toBe(EDGE_TYPE_IMPLICATION);
    expect(parseEdgeType('1')).toBe(EDGE_TYPE_DERIVATION);
    expect(parseEdgeType('2')).toBe(EDGE_TYPE_POSSIBILITY);
    expect(parseEdgeType('3')).toBe(EDGE_TYPE_REQUIRES);
    expect(parseEdgeType('4')).toBe(EDGE_TYPE_CONFOUNDED_BY);
    expect(parseEdgeType('5')).toBe(EDGE_TYPE_INCOMPATIBLE_WITH);
    expect(parseEdgeType('6')).toBe(EDGE_TYPE_FAILS_WHEN);
  });

  it('is case-insensitive', () => {
    expect(parseEdgeType('DERIVATION')).toBe(EDGE_TYPE_DERIVATION);
    expect(parseEdgeType('CONFOUNDEDBY')).toBe(EDGE_TYPE_CONFOUNDED_BY);
  });

  it('defaults to implication for unknown input', () => {
    expect(parseEdgeType('unknown')).toBe(EDGE_TYPE_IMPLICATION);
    expect(parseEdgeType('')).toBe(EDGE_TYPE_IMPLICATION);
  });
});
