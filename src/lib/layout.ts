import dagre from '@dagrejs/dagre';
import type { GraphNode, GraphEdge, RankDir } from '../domain/types';

export interface LayoutResult {
  nodePositions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

/**
 * Compute hierarchical layout using Dagre (JS port of Graphviz dot algorithm).
 * Replaces the vendored Graphviz C library.
 */
export function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  rankdir: RankDir = 'TB',
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 50, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.sourceId, edge.targetId);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  let maxX = 0;
  let maxY = 0;

  for (const node of nodes) {
    const pos = g.node(node.id);
    if (pos) {
      // Dagre gives center positions; React Flow uses top-left
      const x = pos.x - NODE_WIDTH / 2;
      const y = pos.y - NODE_HEIGHT / 2;
      positions.set(node.id, { x, y });
      if (pos.x + NODE_WIDTH / 2 > maxX) maxX = pos.x + NODE_WIDTH / 2;
      if (pos.y + NODE_HEIGHT / 2 > maxY) maxY = pos.y + NODE_HEIGHT / 2;
    }
  }

  return { nodePositions: positions, width: maxX, height: maxY };
}

export { NODE_WIDTH, NODE_HEIGHT };
