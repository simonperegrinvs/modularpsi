import type { GraphNode, GraphEdge } from './types';

/**
 * Propagate trust from root through the graph via DFS.
 * Ported from legacy/mpsilib/graph.cpp:525-558 (calculeTrust + calculeRegularTrust)
 *
 * Algorithm:
 *   root.trust = 1.0
 *   DFS from root:
 *     for each outgoing edge:
 *       combinedTrust = parent.trust * edge.trust
 *       if combinedTrust > child.trust → update child
 *       recurse
 *
 * Returns new copies of nodes and edges with updated trust/combinedTrust values.
 */
export function propagateTrust(
  nodes: GraphNode[],
  edges: GraphEdge[],
  rootId: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Build lookup maps
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, { ...n, trust: -1 }); // reset all trusts
  }
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of edges) {
    edgeMap.set(e.id, { ...e, combinedTrust: -1 });
  }

  // Build adjacency: nodeId → outgoing edges
  const outgoing = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.sourceId) ?? [];
    list.push(e);
    outgoing.set(e.sourceId, list);
  }

  // Set root trust
  const root = nodeMap.get(rootId);
  if (!root) {
    return { nodes: Array.from(nodeMap.values()), edges: Array.from(edgeMap.values()) };
  }
  root.trust = 1.0;

  // DFS propagation
  function dfs(node: GraphNode) {
    const outs = outgoing.get(node.id) ?? [];
    for (const edge of outs) {
      const edgeCopy = edgeMap.get(edge.id)!;
      const child = nodeMap.get(edge.targetId);
      if (!child) continue;

      // Calculate combined trust (from graph.cpp:540-548)
      let combined: number;
      if (node.trust < 0 || edgeCopy.trust < 0) {
        combined = -1;
      } else {
        combined = node.trust * edgeCopy.trust;
      }
      edgeCopy.combinedTrust = combined;

      // Update child trust if this path gives higher trust
      if (combined > child.trust) {
        child.trust = combined;
      }

      dfs(child);
    }
  }

  dfs(root);

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
