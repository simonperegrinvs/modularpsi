import { describe, it, expect } from 'vitest';
import { propagateTrust } from '../trust';
import type { GraphNode, GraphEdge } from '../types';

function makeNode(id: string, trust = -1): GraphNode {
  return { id, name: id, description: '', categoryId: 'general', keywords: [], type: 0, trust, referenceIds: [] };
}

function makeEdge(id: string, sourceId: string, targetId: string, trust: number): GraphEdge {
  return { id, sourceId, targetId, trust, type: 0, combinedTrust: -1 };
}

describe('propagateTrust', () => {
  it('sets root trust to 1.0', () => {
    const nodes = [makeNode('P1')];
    const result = propagateTrust(nodes, [], 'P1');
    expect(result.nodes[0].trust).toBe(1.0);
  });

  it('propagates through a linear chain', () => {
    const nodes = [makeNode('P1'), makeNode('P2')];
    const edges = [makeEdge('e1', 'P1', 'P2', 0.8)];
    const result = propagateTrust(nodes, edges, 'P1');

    expect(result.nodes.find(n => n.id === 'P1')!.trust).toBe(1.0);
    expect(result.nodes.find(n => n.id === 'P2')!.trust).toBeCloseTo(0.8);
    expect(result.edges[0].combinedTrust).toBeCloseTo(0.8);
  });

  it('child gets max of incoming paths', () => {
    // P1 → P2 (0.8), P1 → P3 (0.6), P2 → P4 (0.5), P3 → P4 (0.9)
    const nodes = [makeNode('P1'), makeNode('P2'), makeNode('P3'), makeNode('P4')];
    const edges = [
      makeEdge('e1', 'P1', 'P2', 0.8),
      makeEdge('e2', 'P1', 'P3', 0.6),
      makeEdge('e3', 'P2', 'P4', 0.5), // path: 1.0 * 0.8 * 0.5 = 0.4
      makeEdge('e4', 'P3', 'P4', 0.9), // path: 1.0 * 0.6 * 0.9 = 0.54
    ];
    const result = propagateTrust(nodes, edges, 'P1');
    // P4 should get the max: 0.54
    expect(result.nodes.find(n => n.id === 'P4')!.trust).toBeCloseTo(0.54);
  });

  it('unclassified edges produce combinedTrust=-1', () => {
    const nodes = [makeNode('P1'), makeNode('P2')];
    const edges = [makeEdge('e1', 'P1', 'P2', -1)];
    const result = propagateTrust(nodes, edges, 'P1');

    expect(result.edges[0].combinedTrust).toBe(-1);
    expect(result.nodes.find(n => n.id === 'P2')!.trust).toBe(-1);
  });

  it('returns all trusts as -1 when root is missing', () => {
    const nodes = [makeNode('P1'), makeNode('P2')];
    const edges = [makeEdge('e1', 'P1', 'P2', 0.8)];
    const result = propagateTrust(nodes, edges, 'MISSING');

    expect(result.nodes.every(n => n.trust === -1)).toBe(true);
    expect(result.edges.every(e => e.combinedTrust === -1)).toBe(true);
  });

  it('does not mutate input arrays', () => {
    const nodes = [makeNode('P1'), makeNode('P2')];
    const edges = [makeEdge('e1', 'P1', 'P2', 0.8)];
    const result = propagateTrust(nodes, edges, 'P1');

    expect(nodes[0].trust).toBe(-1); // original unchanged
    expect(result.nodes[0]).not.toBe(nodes[0]); // different object
  });
});
