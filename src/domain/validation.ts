import type { GraphNode, GraphEdge } from './types';
import { NODE_TYPE_CHOOSER } from './types';

/**
 * Check if a node can be deleted.
 * From legacy graph.cpp:422: only leaf nodes (no outgoing edges) can be deleted.
 */
export function canDeleteNode(nodeId: string, edges: GraphEdge[]): { ok: boolean; reason?: string } {
  const hasOutgoing = edges.some((e) => e.sourceId === nodeId);
  if (hasOutgoing) {
    return { ok: false, reason: 'Node has outgoing connections. Only leaf nodes can be deleted.' };
  }
  return { ok: true };
}

/**
 * Check if an edge can be deleted.
 * From legacy graph.cpp:481: edge can only be deleted if target has >= 2 incoming edges
 * (otherwise target would be disconnected from the graph).
 */
export function canDeleteEdge(
  edgeId: string,
  edges: GraphEdge[],
): { ok: boolean; reason?: string } {
  const edge = edges.find((e) => e.id === edgeId);
  if (!edge) {
    return { ok: false, reason: 'Edge not found.' };
  }
  const targetIncoming = edges.filter((e) => e.targetId === edge.targetId);
  if (targetIncoming.length < 2) {
    return { ok: false, reason: 'Target node would be disconnected from the graph.' };
  }
  return { ok: true };
}

/**
 * For CHOOSER nodes, outgoing edge trusts should sum to 1.0.
 * Returns the current sum of outgoing edge trusts for a node.
 */
export function outgoingTrustSum(nodeId: string, edges: GraphEdge[]): number {
  return edges
    .filter((e) => e.sourceId === nodeId && e.trust >= 0)
    .reduce((sum, e) => sum + e.trust, 0);
}

/**
 * Normalize outgoing edge trusts for a CHOOSER node so they sum to 1.0.
 * Returns updated edges array.
 */
export function normalizeChooserEdges(
  node: GraphNode,
  edges: GraphEdge[],
): GraphEdge[] {
  if (node.type !== NODE_TYPE_CHOOSER) return edges;

  const outgoing = edges.filter((e) => e.sourceId === node.id && e.trust >= 0);
  const sum = outgoing.reduce((s, e) => s + e.trust, 0);
  if (sum === 0 || Math.abs(sum - 1.0) < 0.001) return edges;

  const factor = 1.0 / sum;
  const normalizedIds = new Set(outgoing.map((e) => e.id));

  return edges.map((e) => {
    if (normalizedIds.has(e.id)) {
      return { ...e, trust: parseFloat((e.trust * factor).toFixed(4)) };
    }
    return e;
  });
}

/**
 * Validate that an edge can be added between two nodes.
 * Checks: no self-loops, no duplicate edges.
 */
export function canAddEdge(
  sourceId: string,
  targetId: string,
  edges: GraphEdge[],
): { ok: boolean; reason?: string } {
  if (sourceId === targetId) {
    return { ok: false, reason: 'Self-loops are not allowed.' };
  }
  const duplicate = edges.some((e) => e.sourceId === sourceId && e.targetId === targetId);
  if (duplicate) {
    return { ok: false, reason: 'An edge already exists between these nodes.' };
  }
  return { ok: true };
}
