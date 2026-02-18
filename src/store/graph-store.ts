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
} from '../domain/types';
import {
  DEFAULT_CATEGORIES,
  NODE_TYPE_REGULAR,
  EDGE_TYPE_IMPLICATION,
  EDGE_TYPE_DERIVATION,
  NODE_TYPE_HOLDER,
} from '../domain/types';
import { propagateTrust } from '../domain/trust';
import {
  canDeleteNode,
  canDeleteEdge,
  canAddEdge,
  normalizeChooserEdges,
} from '../domain/validation';
import { computeLayout } from '../lib/layout';

// ── Store State ────────────────────────────────────────────────

export interface GraphState {
  // Data
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: Category[];
  references: Reference[];
  prefix: GraphPrefix;
  rootId: string;
  lastNodeNumber: number;

  // UI state
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  mode: InteractionMode;
  edgeSourceId: string | null; // for add-edge-target mode
  rankDir: RankDir;
  familyFilter: string;
  effectFilter: 'all' | 'supports' | 'mixed' | 'null' | 'challenges';
  studyTypeFilter: 'all' | 'meta-analysis' | 'rct' | 'observational' | 'theory' | 'review' | 'replication';
  replicationFilter: 'all' | 'single' | 'independent-replication' | 'failed-replication' | 'multi-lab';
  edgeTrustThreshold: number;
  focusMode: boolean;
  focusDepth: number;
  recentDays: number;
  recentOnly: boolean;

  // Node positions (from layout)
  nodePositions: Map<string, { x: number; y: number }>;

  // File handle for saving
  fileHandle: FileSystemFileHandle | null;

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
  setFamilyFilter: (family: string) => void;
  setEffectFilter: (value: GraphState['effectFilter']) => void;
  setStudyTypeFilter: (value: GraphState['studyTypeFilter']) => void;
  setReplicationFilter: (value: GraphState['replicationFilter']) => void;
  setEdgeTrustThreshold: (value: number) => void;
  setFocusMode: (value: boolean) => void;
  setFocusDepth: (value: number) => void;
  setRecentDays: (value: number) => void;
  setRecentOnly: (value: boolean) => void;
  runLayout: () => void;
  runTrustPropagation: () => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  getGraphData: () => GraphData;
}

// Helper to determine default edge type based on node type and prefix
function defaultEdgeType(sourceNode: GraphNode, prefix: GraphPrefix): EdgeType {
  if (prefix === 'M' || sourceNode.type !== NODE_TYPE_HOLDER) {
    return EDGE_TYPE_DERIVATION;
  }
  // type is NODE_TYPE_HOLDER here
  return EDGE_TYPE_IMPLICATION;
}

export const useGraphStore = create<GraphState>()(
  temporal(
    (set, get) => ({
      // Initial state
      nodes: [],
      edges: [],
      categories: [...DEFAULT_CATEGORIES],
      references: [],
      prefix: 'P' as GraphPrefix,
      rootId: 'P1',
      lastNodeNumber: 0,
      selectedNodeId: null,
      selectedEdgeId: null,
      mode: 'normal' as InteractionMode,
      edgeSourceId: null,
      rankDir: 'TB' as RankDir,
      familyFilter: 'all',
      effectFilter: 'all',
      studyTypeFilter: 'all',
      replicationFilter: 'all',
      edgeTrustThreshold: -1,
      focusMode: false,
      focusDepth: 2,
      recentDays: 30,
      recentOnly: false,
      nodePositions: new Map(),
      fileHandle: null,

      loadGraph: (data: GraphData) => {
        const layout = computeLayout(data.nodes, data.edges, get().rankDir);
        set({
          nodes: data.nodes,
          edges: data.edges,
          categories: data.categories,
          references: data.references,
          prefix: data.prefix,
          rootId: data.rootId,
          lastNodeNumber: data.lastNodeNumber,
          nodePositions: layout.nodePositions,
          selectedNodeId: null,
          selectedEdgeId: null,
          mode: 'normal',
          edgeSourceId: null,
        });
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
        const layout = computeLayout(nodes, edges, state.rankDir);

        set({
          nodes,
          edges,
          lastNodeNumber: nextNum,
          nodePositions: layout.nodePositions,
          selectedNodeId: newId,
          selectedEdgeId: null,
        });

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
        const layout = computeLayout(nodes, edges, state.rankDir);

        set({
          nodes,
          edges,
          nodePositions: layout.nodePositions,
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
          selectedEdgeId: null,
        });
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
        const layout = computeLayout(nodes, edges, state.rankDir);
        set({ nodes, edges, nodePositions: layout.nodePositions });
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
        const layout = computeLayout(nodes, edges, state.rankDir);

        set({
          nodes,
          edges,
          nodePositions: layout.nodePositions,
          selectedEdgeId: edgeId,
          selectedNodeId: null,
        });
        return edgeId;
      },

      deleteEdge: (edgeId: string) => {
        const state = get();
        const check = canDeleteEdge(edgeId, state.edges);
        if (!check.ok) return check;

        const newEdges = state.edges.filter((e) => e.id !== edgeId);
        const { nodes, edges } = propagateTrust(state.nodes, newEdges, state.rootId);
        const layout = computeLayout(nodes, edges, state.rankDir);

        set({
          nodes,
          edges,
          nodePositions: layout.nodePositions,
          selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
        });
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
        const state = get();
        const layout = computeLayout(state.nodes, state.edges, dir);
        set({ rankDir: dir, nodePositions: layout.nodePositions });
      },
      setFamilyFilter: (familyFilter) => set({ familyFilter }),
      setEffectFilter: (effectFilter) => set({ effectFilter }),
      setStudyTypeFilter: (studyTypeFilter) => set({ studyTypeFilter }),
      setReplicationFilter: (replicationFilter) => set({ replicationFilter }),
      setEdgeTrustThreshold: (edgeTrustThreshold) => set({ edgeTrustThreshold }),
      setFocusMode: (focusMode) => set({ focusMode }),
      setFocusDepth: (focusDepth) => set({ focusDepth: Math.max(1, Math.min(6, focusDepth)) }),
      setRecentDays: (recentDays) => set({ recentDays: Math.max(1, Math.min(365, recentDays)) }),
      setRecentOnly: (recentOnly) => set({ recentOnly }),

      runLayout: () => {
        const state = get();
        const layout = computeLayout(state.nodes, state.edges, state.rankDir);
        set({ nodePositions: layout.nodePositions });
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
        set({ nodePositions: newPositions });
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
        };
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
