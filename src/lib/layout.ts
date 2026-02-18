import dagre from '@dagrejs/dagre';
import type { GraphNode, GraphEdge, RankDir } from '../domain/types';

export interface LayoutResult {
  nodePositions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

const NODE_MIN_WIDTH = 160;
const NODE_MAX_WIDTH = 420;
const NODE_MIN_HEIGHT = 56;
const CHARS_PER_LINE = 24;
const CHAR_WIDTH_PX = 7.1;

function countWrappedLines(text: string, maxCharsPerLine: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let currentLen = 0;

  for (const word of words) {
    const w = word.length;
    if (w > maxCharsPerLine) {
      if (currentLen > 0) {
        lines += 1;
        currentLen = 0;
      }
      lines += Math.ceil(w / maxCharsPerLine) - 1;
      currentLen = w % maxCharsPerLine;
      continue;
    }

    if (currentLen === 0) {
      currentLen = w;
      continue;
    }

    if (currentLen + 1 + w <= maxCharsPerLine) {
      currentLen += 1 + w;
    } else {
      lines += 1;
      currentLen = w;
    }
  }

  return Math.max(1, lines);
}

export function getNodeDimensions(node: Pick<GraphNode, 'name'>): { width: number; height: number } {
  const name = node.name?.trim() ?? '';
  const maxWordLen = Math.max(6, ...name.split(/\s+/).filter(Boolean).map((w) => w.length));
  const targetChars = Math.min(Math.max(maxWordLen + 4, CHARS_PER_LINE), 44);
  const lines = countWrappedLines(name, targetChars);

  const textWidth = targetChars * CHAR_WIDTH_PX;
  const width = Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, textWidth + 36));
  const height = Math.max(NODE_MIN_HEIGHT, 34 + (lines * 16));

  return { width: Math.round(width), height: Math.round(height) };
}

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
  g.setGraph({ rankdir, nodesep: 70, ranksep: 110, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  const dimensions = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const dim = getNodeDimensions(node);
    dimensions.set(node.id, dim);
    g.setNode(node.id, { width: dim.width, height: dim.height });
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
    const dim = dimensions.get(node.id) ?? getNodeDimensions(node);
    if (pos) {
      // Dagre gives center positions; React Flow uses top-left
      const x = pos.x - dim.width / 2;
      const y = pos.y - dim.height / 2;
      positions.set(node.id, { x, y });
      if (pos.x + dim.width / 2 > maxX) maxX = pos.x + dim.width / 2;
      if (pos.y + dim.height / 2 > maxY) maxY = pos.y + dim.height / 2;
    }
  }

  return { nodePositions: positions, width: maxX, height: maxY };
}

export { NODE_MIN_WIDTH, NODE_MIN_HEIGHT };
