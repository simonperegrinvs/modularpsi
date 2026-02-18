import { describe, it, expect } from 'vitest';
import {
  canDeleteNode,
  canDeleteEdge,
  canAddEdge,
  normalizeChooserEdges,
  outgoingTrustSum,
} from '../validation';
import type { GraphNode, GraphEdge } from '../types';
import { NODE_TYPE_CHOOSER, NODE_TYPE_REGULAR } from '../types';

function makeEdge(id: string, sourceId: string, targetId: string, trust = 0.5): GraphEdge {
  return { id, sourceId, targetId, trust, type: 0, combinedTrust: -1 };
}

function makeNode(id: string, type: 0 | 1 | 2 = 0): GraphNode {
  return { id, name: id, description: '', categoryId: 'general', keywords: [], type, trust: -1, referenceIds: [] };
}

describe('canDeleteNode', () => {
  it('allows deleting a leaf node', () => {
    const edges = [makeEdge('e1', 'P1', 'P2')];
    expect(canDeleteNode('P2', edges)).toEqual({ ok: true });
  });

  it('rejects deleting a node with outgoing edges', () => {
    const edges = [makeEdge('e1', 'P1', 'P2')];
    const result = canDeleteNode('P1', edges);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('outgoing');
  });
});

describe('canDeleteEdge', () => {
  it('allows deleting when target has 2+ incoming edges', () => {
    const edges = [
      makeEdge('e1', 'P1', 'P3'),
      makeEdge('e2', 'P2', 'P3'),
    ];
    expect(canDeleteEdge('e1', edges)).toEqual({ ok: true });
  });

  it('rejects deleting when target has only 1 incoming edge', () => {
    const edges = [makeEdge('e1', 'P1', 'P2')];
    const result = canDeleteEdge('e1', edges);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('disconnected');
  });

  it('rejects when edge not found', () => {
    const result = canDeleteEdge('missing', []);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not found');
  });
});

describe('canAddEdge', () => {
  it('rejects self-loops', () => {
    const result = canAddEdge('P1', 'P1', []);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Self-loop');
  });

  it('rejects duplicate edges', () => {
    const edges = [makeEdge('e1', 'P1', 'P2')];
    const result = canAddEdge('P1', 'P2', edges);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('already exists');
  });

  it('allows valid new edges', () => {
    expect(canAddEdge('P1', 'P2', [])).toEqual({ ok: true });
  });
});

describe('normalizeChooserEdges', () => {
  it('normalizes outgoing edges of a chooser node to sum to 1.0', () => {
    const node = makeNode('P1', NODE_TYPE_CHOOSER);
    const edges = [
      makeEdge('e1', 'P1', 'P2', 0.3),
      makeEdge('e2', 'P1', 'P3', 0.3),
      makeEdge('e3', 'P1', 'P4', 0.3),
    ];
    const result = normalizeChooserEdges(node, edges);
    const sum = result
      .filter(e => e.sourceId === 'P1')
      .reduce((s, e) => s + e.trust, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('is a no-op for regular nodes', () => {
    const node = makeNode('P1', NODE_TYPE_REGULAR);
    const edges = [makeEdge('e1', 'P1', 'P2', 0.3)];
    const result = normalizeChooserEdges(node, edges);
    expect(result).toBe(edges); // same reference
  });

  it('is a no-op when edges already sum to 1.0', () => {
    const node = makeNode('P1', NODE_TYPE_CHOOSER);
    const edges = [
      makeEdge('e1', 'P1', 'P2', 0.5),
      makeEdge('e2', 'P1', 'P3', 0.5),
    ];
    const result = normalizeChooserEdges(node, edges);
    expect(result).toBe(edges);
  });

  it('leaves unclassified edges unchanged', () => {
    const node = makeNode('P1', NODE_TYPE_CHOOSER);
    const edges = [
      makeEdge('e1', 'P1', 'P2', 0.6),
      makeEdge('e2', 'P1', 'P3', -1),
    ];
    const result = normalizeChooserEdges(node, edges);
    const unclassified = result.find(e => e.id === 'e2')!;
    expect(unclassified.trust).toBe(-1);
  });
});

describe('outgoingTrustSum', () => {
  it('sums trust of outgoing edges', () => {
    const edges = [
      makeEdge('e1', 'P1', 'P2', 0.3),
      makeEdge('e2', 'P1', 'P3', 0.5),
      makeEdge('e3', 'P2', 'P4', 0.9), // not from P1
    ];
    expect(outgoingTrustSum('P1', edges)).toBeCloseTo(0.8);
  });

  it('excludes unclassified edges', () => {
    const edges = [
      makeEdge('e1', 'P1', 'P2', 0.5),
      makeEdge('e2', 'P1', 'P3', -1),
    ];
    expect(outgoingTrustSum('P1', edges)).toBeCloseTo(0.5);
  });

  it('returns 0 when no outgoing edges', () => {
    expect(outgoingTrustSum('P1', [])).toBe(0);
  });
});
