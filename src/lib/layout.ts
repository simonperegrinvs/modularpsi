import dagre from '@dagrejs/dagre';
import type { GraphNode, GraphEdge, RankDir, Category, ClusterBounds } from '../domain/types';
import { resolveOverlaps, computeNodeSizes } from './graph-utils';

export interface LayoutResult {
  nodePositions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

export interface ClusteredLayoutResult extends LayoutResult {
  clusterBounds: ClusterBounds[];
}

export interface ClusteredLayoutOptions {
  rankdir: RankDir;
  collapsedClusters: Set<string>;
  pinnedPositions: Map<string, { x: number; y: number }>;
  nodeSizeOverrides?: Map<string, { width: number; height: number }>;
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

// ── Clustered Layout ────────────────────────────────────────

const CLUSTER_PADDING = 40;

export function computeClusteredLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  categories: Category[],
  options: ClusteredLayoutOptions,
): ClusteredLayoutResult {
  const { rankdir, collapsedClusters, pinnedPositions, nodeSizeOverrides } = options;

  // Compute sizes from degree if not provided
  const sizes = nodeSizeOverrides ?? computeNodeSizes(nodes, edges);

  // Group nodes by category
  const catNodes = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const catId = node.categoryId;
    if (!catNodes.has(catId)) catNodes.set(catId, []);
    catNodes.get(catId)!.push(node);
  }

  // Build dagre graph with compound support
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir, nodesep: 50, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  // Track collapsed cluster synthetic nodes
  const collapsedSyntheticIds = new Map<string, string>(); // catId → synthetic node id
  const collapsedMembers = new Map<string, Set<string>>(); // catId → member node ids

  // Add cluster parent nodes and individual nodes
  for (const [catId, catMembers] of catNodes) {
    const clusterId = `cluster-${catId}`;

    if (collapsedClusters.has(catId) && catMembers.length > 0) {
      // Collapsed: create synthetic summary node
      const syntheticId = `__collapsed__${catId}`;
      collapsedSyntheticIds.set(catId, syntheticId);
      collapsedMembers.set(catId, new Set(catMembers.map((n) => n.id)));

      const cat = categories.find((c) => c.id === catId);
      const label = `${cat?.name ?? catId} (${catMembers.length} nodes)`;
      g.setNode(syntheticId, {
        width: Math.max(NODE_WIDTH, label.length * 7 + 40),
        height: NODE_HEIGHT,
      });
    } else {
      // Expanded: use compound grouping
      g.setNode(clusterId, { label: catId });
      for (const node of catMembers) {
        const size = sizes.get(node.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
        g.setNode(node.id, { width: size.width, height: size.height });
        g.setParent(node.id, clusterId);
      }
    }
  }

  // Add edges, rerouting through synthetic nodes for collapsed clusters
  for (const edge of edges) {
    let sourceId = edge.sourceId;
    let targetId = edge.targetId;

    // Check if source/target are in collapsed clusters
    for (const [catId, members] of collapsedMembers) {
      const synId = collapsedSyntheticIds.get(catId)!;
      if (members.has(sourceId)) sourceId = synId;
      if (members.has(targetId)) targetId = synId;
    }

    // Skip self-loops (both ends in same collapsed cluster)
    if (sourceId === targetId) continue;

    // Skip if either node doesn't exist in graph
    if (!g.hasNode(sourceId) || !g.hasNode(targetId)) continue;

    g.setEdge(sourceId, targetId);
  }

  dagre.layout(g);

  // Extract positions
  const positions = new Map<string, { x: number; y: number }>();
  let maxX = 0;
  let maxY = 0;

  for (const node of nodes) {
    // Check if this node is in a collapsed cluster
    let isCollapsed = false;
    for (const [, members] of collapsedMembers) {
      if (members.has(node.id)) {
        isCollapsed = true;
        break;
      }
    }
    if (isCollapsed) continue;

    const pos = g.node(node.id);
    if (pos) {
      const size = sizes.get(node.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
      const x = pos.x - size.width / 2;
      const y = pos.y - size.height / 2;
      positions.set(node.id, { x, y });
      if (pos.x + size.width / 2 > maxX) maxX = pos.x + size.width / 2;
      if (pos.y + size.height / 2 > maxY) maxY = pos.y + size.height / 2;
    }
  }

  // Add positions for collapsed synthetic nodes
  for (const [, synId] of collapsedSyntheticIds) {
    const pos = g.node(synId);
    if (pos) {
      positions.set(synId, { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 });
      if (pos.x + NODE_WIDTH / 2 > maxX) maxX = pos.x + NODE_WIDTH / 2;
      if (pos.y + NODE_HEIGHT / 2 > maxY) maxY = pos.y + NODE_HEIGHT / 2;
    }
  }

  // Override pinned positions
  for (const [nodeId, pos] of pinnedPositions) {
    if (positions.has(nodeId)) {
      positions.set(nodeId, pos);
    }
  }

  // Resolve overlaps
  const pinnedIds = new Set(pinnedPositions.keys());
  const resolvedPositions = resolveOverlaps(positions, sizes, pinnedIds);

  // Compute cluster bounding boxes from member positions
  const clusterBounds: ClusterBounds[] = [];
  for (const [catId, catMembers] of catNodes) {
    if (collapsedClusters.has(catId)) continue;
    if (catMembers.length === 0) continue;

    let minX = Infinity, minY = Infinity, cMaxX = -Infinity, cMaxY = -Infinity;
    let hasPositionedMembers = false;

    for (const node of catMembers) {
      const pos = resolvedPositions.get(node.id);
      if (!pos) continue;
      hasPositionedMembers = true;
      const size = sizes.get(node.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      cMaxX = Math.max(cMaxX, pos.x + size.width);
      cMaxY = Math.max(cMaxY, pos.y + size.height);
    }

    if (hasPositionedMembers) {
      clusterBounds.push({
        categoryId: catId,
        x: minX - CLUSTER_PADDING,
        y: minY - CLUSTER_PADDING,
        width: cMaxX - minX + CLUSTER_PADDING * 2,
        height: cMaxY - minY + CLUSTER_PADDING * 2,
      });
    }
  }

  return {
    nodePositions: resolvedPositions,
    clusterBounds,
    width: maxX,
    height: maxY,
  };
}

export { NODE_WIDTH, NODE_HEIGHT };
