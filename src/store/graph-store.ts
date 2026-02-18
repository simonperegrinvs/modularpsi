import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  GraphNode,
  GraphEdge,
  Category,
  Reference,
  GraphData,
  GraphPrefix,
  RankDir,
  InteractionMode,
  NodeType,
  EdgeType,
  GraphFilterState,
  FocusModeState,
  ClusterState,
  ClusterBounds,
  ReviewStatus,
} from '../domain/types';
import {
  DEFAULT_CATEGORIES,
  NODE_TYPE_REGULAR,
  NODE_TYPE_HOLDER,
  EDGE_TYPE_IMPLICATION,
  EDGE_TYPE_DERIVATION,
} from '../domain/types';
import { propagateTrust } from '../domain/trust';
import {
  canDeleteNode,
  canDeleteEdge,
  canAddEdge,
  normalizeChooserEdges,
} from '../domain/validation';
import { computeClusteredLayout } from '../lib/layout';
import { applyFilters, findRecentChanges, computeNodeSizes } from '../lib/graph-utils';

// ── Store State ────────────────────────────────────────────────

export interface GraphState {
  // Data
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: Category[];
  references: Reference[];
  hypotheses: GraphData['hypotheses'];
  prefix: GraphPrefix;
  rootId: string;
  lastNodeNumber: number;

  // UI state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  mode: InteractionMode;
  edgeSourceId: string | null; // for add-edge-target mode
  rankDir: RankDir;

  // Node positions (from layout)
  nodePositions: Map<string, { x: number; y: number }>;

  // File handle for saving
  fileHandle: FileSystemFileHandle | null;

  // Filter / Focus / Cluster state
  filters: GraphFilterState;
  focusMode: FocusModeState;
  clusterState: ClusterState;
  pinnedNodeIds: Set<string>;

  // Derived visible graph (recomputed via recomputeVisibleGraph)
  visibleNodes: GraphNode[];
  visibleEdges: GraphEdge[];
  clusterBounds: ClusterBounds[];
  recentChangeIds: Set<string>;
  nodeSizes: Map<string, { width: number; height: number }>;

  // Actions
  loadGraph: (data: GraphData) => void;
  addNode: (parentId: string, name?: string, type?: NodeType) => string | null;
  deleteNode: (nodeId: string) => { ok: boolean; reason?: string };
  updateNode: (nodeId: string, updates: Partial<Pick<GraphNode, 'name' | 'description' | 'categoryId' | 'keywords' | 'type' | 'referenceIds'>>) => void;
  addEdge: (sourceId: string, targetId: string, trust?: number, type?: EdgeType) => string | null;
  deleteEdge: (edgeId: string) => { ok: boolean; reason?: string };
  updateEdge: (edgeId: string, updates: Partial<Pick<GraphEdge, 'trust' | 'type'>>) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setMode: (mode: InteractionMode) => void;
  setEdgeSource: (nodeId: string | null) => void;
  setRankDir: (dir: RankDir) => void;
  runLayout: () => void;
  runTrustPropagation: () => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  getGraphData: () => GraphData;

  // Filter / Focus / Cluster actions
  setFilter: (updates: Partial<GraphFilterState>) => void;
  setEdgeTrustThreshold: (threshold: number) => void;
  toggleCategoryVisibility: (catId: string) => void;
  setFocusMode: (centerId: string | null, hops: number) => void;
  toggleClusterCollapse: (catId: string) => void;
  togglePinNode: (nodeId: string) => void;
  unpinAllNodes: () => void;
  setRecentChangeDays: (days: number) => void;
  recomputeVisibleGraph: () => void;
}

// Helper to determine default edge type based on node type and prefix
function defaultEdgeType(sourceNode: GraphNode, prefix: GraphPrefix): EdgeType {
  if (prefix === 'M' || sourceNode.type !== NODE_TYPE_HOLDER) {
    return EDGE_TYPE_DERIVATION;
  }
  // type is NODE_TYPE_HOLDER here
  return EDGE_TYPE_IMPLICATION;
}

function defaultFilters(): GraphFilterState {
  return {
    visibleCategories: new Set<string>(),
    edgeTrustThreshold: 0,
    sourceApiFilter: new Set<string>(),
    dateRange: { from: null, to: null },
    nodeTypeFilter: new Set<NodeType>(),
    reviewStatusFilter: new Set<ReviewStatus>(),
    recentChangeDays: 0,
  };
}

function defaultFocusMode(): FocusModeState {
  return { enabled: false, centerId: null, hops: 2 };
}

function defaultClusterState(): ClusterState {
  return { collapsedClusters: new Set<string>() };
}

export const useGraphStore = create<GraphState>()(
  temporal(
    (set, get) => ({
      // Initial state
      nodes: [],
      edges: [],
      categories: [...DEFAULT_CATEGORIES],
      references: [],
      hypotheses: [],
      prefix: 'P' as GraphPrefix,
      rootId: 'P1',
      lastNodeNumber: 0,
      selectedNodeId: null,
      selectedEdgeId: null,
      mode: 'normal' as InteractionMode,
      edgeSourceId: null,
      rankDir: 'TB' as RankDir,
      nodePositions: new Map(),
      fileHandle: null,

      // Filter / Focus / Cluster state
      filters: defaultFilters(),
      focusMode: defaultFocusMode(),
      clusterState: defaultClusterState(),
      pinnedNodeIds: new Set<string>(),

      // Derived visible graph
      visibleNodes: [],
      visibleEdges: [],
      clusterBounds: [],
      recentChangeIds: new Set<string>(),
      nodeSizes: new Map(),

      loadGraph: (data: GraphData) => {
        set({
          nodes: data.nodes,
          edges: data.edges,
          categories: data.categories,
          references: data.references,
          hypotheses: data.hypotheses,
          prefix: data.prefix,
          rootId: data.rootId,
          lastNodeNumber: data.lastNodeNumber,
          selectedNodeId: null,
          selectedEdgeId: null,
          mode: 'normal',
          edgeSourceId: null,
          filters: defaultFilters(),
          focusMode: defaultFocusMode(),
          clusterState: defaultClusterState(),
          pinnedNodeIds: new Set<string>(),
        });
        // Recompute after setting data
        get().recomputeVisibleGraph();
      },

      addNode: (parentId: string, name?: string, type?: NodeType) => {
        const state = get();
        const nextNum = state.lastNodeNumber + 1;
        const newId = `${state.prefix}${nextNum}`;

        const newNode: GraphNode = {
          id: newId,
          name: name ?? 'New Node',
          description: '',
          categoryId: 'general',
          keywords: [],
          type: type ?? NODE_TYPE_REGULAR,
          trust: -1,
          referenceIds: [],
        };

        const parent = state.nodes.find((n) => n.id === parentId);
        const edgeType = parent ? defaultEdgeType(parent, state.prefix) : EDGE_TYPE_IMPLICATION;

        const newEdge: GraphEdge = {
          id: `${parentId}-${newId}`,
          sourceId: parentId,
          targetId: newId,
          trust: -1,
          type: edgeType,
          combinedTrust: -1,
        };

        const newNodes = [...state.nodes, newNode];
        const newEdges = [...state.edges, newEdge];
        const { nodes, edges } = propagateTrust(newNodes, newEdges, state.rootId);

        set({
          nodes,
          edges,
          lastNodeNumber: nextNum,
          selectedNodeId: newId,
          selectedEdgeId: null,
        });
        get().recomputeVisibleGraph();

        return newId;
      },

      deleteNode: (nodeId: string) => {
        const state = get();
        const check = canDeleteNode(nodeId, state.edges);
        if (!check.ok) return check;

        // Remove the node and all its incoming edges
        const newNodes = state.nodes.filter((n) => n.id !== nodeId);
        const newEdges = state.edges.filter(
          (e) => e.sourceId !== nodeId && e.targetId !== nodeId,
        );
        const { nodes, edges } = propagateTrust(newNodes, newEdges, state.rootId);

        // Unpin deleted node
        const newPinned = new Set(state.pinnedNodeIds);
        newPinned.delete(nodeId);

        set({
          nodes,
          edges,
          pinnedNodeIds: newPinned,
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
          selectedEdgeId: null,
        });
        get().recomputeVisibleGraph();
        return { ok: true };
      },

      updateNode: (nodeId: string, updates) => {
        const state = get();
        const newNodes = state.nodes.map((n) =>
          n.id === nodeId ? { ...n, ...updates } : n,
        );
        let newEdges = state.edges;

        // If type changed to CHOOSER, normalize outgoing edges
        if (updates.type !== undefined) {
          const node = newNodes.find((n) => n.id === nodeId);
          if (node) {
            newEdges = normalizeChooserEdges(node, newEdges);
          }
        }

        const { nodes, edges } = propagateTrust(newNodes, newEdges, state.rootId);
        set({ nodes, edges });
      },

      addEdge: (sourceId: string, targetId: string, trust?: number, type?: EdgeType) => {
        const state = get();
        const check = canAddEdge(sourceId, targetId, state.edges);
        if (!check.ok) return null;

        const edgeId = `${sourceId}-${targetId}`;
        const source = state.nodes.find((n) => n.id === sourceId);
        const edgeType = type ?? (source ? defaultEdgeType(source, state.prefix) : EDGE_TYPE_IMPLICATION);

        const newEdge: GraphEdge = {
          id: edgeId,
          sourceId,
          targetId,
          trust: trust ?? -1,
          type: edgeType,
          combinedTrust: -1,
        };

        const newEdges = [...state.edges, newEdge];
        const { nodes, edges } = propagateTrust(state.nodes, newEdges, state.rootId);

        set({
          nodes,
          edges,
          selectedEdgeId: edgeId,
          selectedNodeId: null,
        });
        get().recomputeVisibleGraph();
        return edgeId;
      },

      deleteEdge: (edgeId: string) => {
        const state = get();
        const check = canDeleteEdge(edgeId, state.edges);
        if (!check.ok) return check;

        const newEdges = state.edges.filter((e) => e.id !== edgeId);
        const { nodes, edges } = propagateTrust(state.nodes, newEdges, state.rootId);

        set({
          nodes,
          edges,
          selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
        });
        get().recomputeVisibleGraph();
        return { ok: true };
      },

      updateEdge: (edgeId: string, updates) => {
        const state = get();
        let newEdges = state.edges.map((e) =>
          e.id === edgeId ? { ...e, ...updates } : e,
        );

        // If edge belongs to a CHOOSER node, normalize
        const edge = newEdges.find((e) => e.id === edgeId);
        if (edge) {
          const sourceNode = state.nodes.find((n) => n.id === edge.sourceId);
          if (sourceNode) {
            newEdges = normalizeChooserEdges(sourceNode, newEdges);
          }
        }

        const { nodes, edges } = propagateTrust(state.nodes, newEdges, state.rootId);
        set({ nodes, edges });
      },

      selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
      selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),
      setMode: (mode) => set({ mode, edgeSourceId: null }),
      setEdgeSource: (nodeId) => set({ edgeSourceId: nodeId }),
      setRankDir: (dir) => {
        set({ rankDir: dir });
        get().recomputeVisibleGraph();
      },

      runLayout: () => {
        get().recomputeVisibleGraph();
      },

      runTrustPropagation: () => {
        const state = get();
        const { nodes, edges } = propagateTrust(state.nodes, state.edges, state.rootId);
        set({ nodes, edges });
      },

      updateNodePosition: (nodeId, x, y) => {
        const state = get();
        const newPositions = new Map(state.nodePositions);
        newPositions.set(nodeId, { x, y });
        // Auto-pin dragged nodes
        const newPinned = new Set(state.pinnedNodeIds);
        newPinned.add(nodeId);
        set({ nodePositions: newPositions, pinnedNodeIds: newPinned });
      },

      addCategory: (category) => {
        set((state) => ({ categories: [...state.categories, category] }));
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        }));
      },

      setFileHandle: (handle) => set({ fileHandle: handle }),

      getGraphData: () => {
        const state = get();
        return {
          version: 1,
          prefix: state.prefix,
          rootId: state.rootId,
          lastNodeNumber: state.lastNodeNumber,
          nodes: state.nodes,
          edges: state.edges,
          categories: state.categories,
          references: state.references,
          hypotheses: state.hypotheses,
        };
      },

      // ── Filter / Focus / Cluster Actions ──────────────────

      setFilter: (updates) => {
        const state = get();
        set({ filters: { ...state.filters, ...updates } });
        get().recomputeVisibleGraph();
      },

      setEdgeTrustThreshold: (threshold) => {
        const state = get();
        set({ filters: { ...state.filters, edgeTrustThreshold: threshold } });
        get().recomputeVisibleGraph();
      },

      toggleCategoryVisibility: (catId) => {
        const state = get();
        const newCats = new Set(state.filters.visibleCategories);
        if (newCats.has(catId)) {
          newCats.delete(catId);
        } else {
          newCats.add(catId);
        }
        set({ filters: { ...state.filters, visibleCategories: newCats } });
        get().recomputeVisibleGraph();
      },

      setFocusMode: (centerId, hops) => {
        set({
          focusMode: {
            enabled: centerId !== null,
            centerId,
            hops,
          },
        });
        get().recomputeVisibleGraph();
      },

      toggleClusterCollapse: (catId) => {
        const state = get();
        const newCollapsed = new Set(state.clusterState.collapsedClusters);
        if (newCollapsed.has(catId)) {
          newCollapsed.delete(catId);
        } else {
          newCollapsed.add(catId);
        }
        set({ clusterState: { collapsedClusters: newCollapsed } });
        get().recomputeVisibleGraph();
      },

      togglePinNode: (nodeId) => {
        const state = get();
        const newPinned = new Set(state.pinnedNodeIds);
        if (newPinned.has(nodeId)) {
          newPinned.delete(nodeId);
        } else {
          newPinned.add(nodeId);
        }
        set({ pinnedNodeIds: newPinned });
      },

      unpinAllNodes: () => {
        set({ pinnedNodeIds: new Set<string>() });
        get().recomputeVisibleGraph();
      },

      setRecentChangeDays: (days) => {
        const state = get();
        set({ filters: { ...state.filters, recentChangeDays: days } });
        get().recomputeVisibleGraph();
      },

      recomputeVisibleGraph: () => {
        const state = get();
        const { nodes: filtered, edges: filteredEdges } = applyFilters(
          state.nodes,
          state.edges,
          state.filters,
          state.focusMode,
        );

        const sizes = computeNodeSizes(filtered, filteredEdges);
        const recentIds = findRecentChanges(
          state.nodes,
          state.edges,
          state.references,
          state.filters.recentChangeDays,
        );

        // Build pinned positions from current positions
        const pinnedPositions = new Map<string, { x: number; y: number }>();
        for (const nodeId of state.pinnedNodeIds) {
          const pos = state.nodePositions.get(nodeId);
          if (pos) pinnedPositions.set(nodeId, pos);
        }

        const layout = computeClusteredLayout(
          filtered,
          filteredEdges,
          state.categories,
          {
            rankdir: state.rankDir,
            collapsedClusters: state.clusterState.collapsedClusters,
            pinnedPositions,
            nodeSizeOverrides: sizes,
          },
        );

        set({
          visibleNodes: filtered,
          visibleEdges: filteredEdges,
          nodePositions: layout.nodePositions,
          clusterBounds: layout.clusterBounds,
          recentChangeIds: recentIds,
          nodeSizes: sizes,
        });
      },
    }),
    {
      // Temporal middleware config: only track data changes, not UI state
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        categories: state.categories,
        lastNodeNumber: state.lastNodeNumber,
      }),
    },
  ),
);
