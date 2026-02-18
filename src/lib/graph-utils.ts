import type {
  GraphNode,
  GraphEdge,
  Reference,
  GraphFilterState,
  FocusModeState,
} from '../domain/types';
import { NODE_WIDTH, NODE_HEIGHT } from './layout';

// ── Ego Graph (BFS k-hop neighborhood, bidirectional) ───────

export function computeEgoGraph(
  centerId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  hops: number,
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>([centerId]);
  const edgeIds = new Set<string>();

  // Build adjacency (bidirectional)
  const adj = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
  for (const e of edges) {
    if (!adj.has(e.sourceId)) adj.set(e.sourceId, []);
    if (!adj.has(e.targetId)) adj.set(e.targetId, []);
    adj.get(e.sourceId)!.push({ neighbor: e.targetId, edgeId: e.id });
    adj.get(e.targetId)!.push({ neighbor: e.sourceId, edgeId: e.id });
  }

  let frontier = new Set<string>([centerId]);
  for (let h = 0; h < hops; h++) {
    const nextFrontier = new Set<string>();
    for (const nodeId of frontier) {
      for (const { neighbor, edgeId } of adj.get(nodeId) ?? []) {
        if (!nodeIds.has(neighbor)) {
          nodeIds.add(neighbor);
          nextFrontier.add(neighbor);
        }
        edgeIds.add(edgeId);
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  // Only keep nodes that actually exist in the input
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  for (const id of nodeIds) {
    if (!nodeIdSet.has(id)) nodeIds.delete(id);
  }

  return { nodeIds, edgeIds };
}

// ── Node Degrees ────────────────────────────────────────────

export function computeNodeDegrees(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const n of nodes) degrees.set(n.id, 0);
  for (const e of edges) {
    degrees.set(e.sourceId, (degrees.get(e.sourceId) ?? 0) + 1);
    degrees.set(e.targetId, (degrees.get(e.targetId) ?? 0) + 1);
  }
  return degrees;
}

// ── Node Sizes (degree-scaled) ──────────────────────────────

const BASE_WIDTH = NODE_WIDTH; // 180
const BASE_HEIGHT = NODE_HEIGHT; // 60
const MAX_WIDTH = 240;
const MAX_HEIGHT = 90;
const DEGREE_BONUS_W = 6;
const DEGREE_BONUS_H = 3;

export function computeNodeSizes(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, { width: number; height: number }> {
  const degrees = computeNodeDegrees(nodes, edges);
  const sizes = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    const deg = degrees.get(n.id) ?? 0;
    sizes.set(n.id, {
      width: Math.min(BASE_WIDTH + deg * DEGREE_BONUS_W, MAX_WIDTH),
      height: Math.min(BASE_HEIGHT + deg * DEGREE_BONUS_H, MAX_HEIGHT),
    });
  }
  return sizes;
}

// ── Recent Changes ──────────────────────────────────────────

export function findRecentChanges(
  nodes: GraphNode[],
  edges: GraphEdge[],
  refs: Reference[],
  days: number,
): Set<string> {
  if (days <= 0) return new Set();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();
  const ids = new Set<string>();

  for (const n of nodes) {
    if (n.provenance?.timestamp && n.provenance.timestamp >= cutoffIso) {
      ids.add(n.id);
    }
  }
  for (const e of edges) {
    if (e.provenance?.timestamp && e.provenance.timestamp >= cutoffIso) {
      ids.add(e.id);
    }
  }
  for (const r of refs) {
    if (r.provenance?.timestamp && r.provenance.timestamp >= cutoffIso) {
      ids.add(r.id);
    }
  }
  return ids;
}

// ── Filter Pipeline ─────────────────────────────────────────

export function applyFilters(
  nodes: GraphNode[],
  edges: GraphEdge[],
  filters: GraphFilterState,
  focusMode: FocusModeState,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  let filteredNodes = nodes;

  // 1. Category filter
  if (filters.visibleCategories.size > 0) {
    filteredNodes = filteredNodes.filter((n) =>
      filters.visibleCategories.has(n.categoryId),
    );
  }

  // 2. Source API filter
  if (filters.sourceApiFilter.size > 0) {
    filteredNodes = filteredNodes.filter((n) => {
      if (!n.provenance?.apiSource && !n.provenance?.source) {
        // Keep nodes without provenance if 'human' is in filter
        return filters.sourceApiFilter.has('human');
      }
      const src = n.provenance?.apiSource ?? n.provenance?.source ?? 'human';
      return filters.sourceApiFilter.has(src);
    });
  }

  // 3. Date range filter
  if (filters.dateRange.from || filters.dateRange.to) {
    filteredNodes = filteredNodes.filter((n) => {
      const ts = n.provenance?.timestamp;
      if (!ts) return true; // keep nodes without timestamps
      if (filters.dateRange.from && ts < filters.dateRange.from) return false;
      if (filters.dateRange.to && ts > filters.dateRange.to + 'T23:59:59Z')
        return false;
      return true;
    });
  }

  // 4. Node type filter
  if (filters.nodeTypeFilter.size > 0) {
    filteredNodes = filteredNodes.filter((n) =>
      filters.nodeTypeFilter.has(n.type),
    );
  }

  // 5. Review status filter
  if (filters.reviewStatusFilter.size > 0) {
    filteredNodes = filteredNodes.filter((n) =>
      filters.reviewStatusFilter.has(n.reviewStatus ?? 'draft'),
    );
  }

  // 6. Focus mode (ego graph)
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  if (focusMode.enabled && focusMode.centerId && visibleNodeIds.has(focusMode.centerId)) {
    const ego = computeEgoGraph(focusMode.centerId, filteredNodes, edges, focusMode.hops);
    filteredNodes = filteredNodes.filter((n) => ego.nodeIds.has(n.id));
    visibleNodeIds.clear();
    for (const n of filteredNodes) visibleNodeIds.add(n.id);
  }

  // Filter edges: both endpoints must be visible, trust above threshold
  let filteredEdges = edges.filter(
    (e) => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId),
  );

  // 7. Edge trust threshold (skip unclassified edges with trust -1)
  if (filters.edgeTrustThreshold > 0) {
    filteredEdges = filteredEdges.filter(
      (e) => e.trust < 0 || e.trust >= filters.edgeTrustThreshold,
    );
  }

  return { nodes: filteredNodes, edges: filteredEdges };
}

// ── Overlap Resolution ──────────────────────────────────────

const OVERLAP_PADDING = 20;
const MAX_ITERATIONS = 50;

export function resolveOverlaps(
  positions: Map<string, { x: number; y: number }>,
  sizes: Map<string, { width: number; height: number }>,
  pinnedIds: Set<string>,
): Map<string, { x: number; y: number }> {
  const result = new Map(positions);
  const nodeIds = [...result.keys()].filter((id) => !pinnedIds.has(id));

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let moved = false;
    for (const id of nodeIds) {
      const pos = result.get(id)!;
      const size = sizes.get(id) ?? { width: BASE_WIDTH, height: BASE_HEIGHT };

      for (const otherId of result.keys()) {
        if (otherId === id) continue;
        const otherPos = result.get(otherId)!;
        const otherSize = sizes.get(otherId) ?? {
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
        };

        const overlapX =
          (size.width + otherSize.width) / 2 +
          OVERLAP_PADDING -
          Math.abs(pos.x + size.width / 2 - (otherPos.x + otherSize.width / 2));
        const overlapY =
          (size.height + otherSize.height) / 2 +
          OVERLAP_PADDING -
          Math.abs(
            pos.y + size.height / 2 - (otherPos.y + otherSize.height / 2),
          );

        if (overlapX > 0 && overlapY > 0) {
          // Displace along axis with smaller overlap
          const dx =
            pos.x + size.width / 2 > otherPos.x + otherSize.width / 2
              ? overlapX / 2
              : -overlapX / 2;
          const dy =
            pos.y + size.height / 2 > otherPos.y + otherSize.height / 2
              ? overlapY / 2
              : -overlapY / 2;

          if (Math.abs(overlapX) < Math.abs(overlapY)) {
            result.set(id, { x: pos.x + dx, y: pos.y });
            if (!pinnedIds.has(otherId)) {
              result.set(otherId, { x: otherPos.x - dx, y: otherPos.y });
            }
          } else {
            result.set(id, { x: pos.x, y: pos.y + dy });
            if (!pinnedIds.has(otherId)) {
              result.set(otherId, { x: otherPos.x, y: otherPos.y - dy });
            }
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return result;
}
