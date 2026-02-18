// ── Node Types ──────────────────────────────────────────────
export const NODE_TYPE_REGULAR = 0 as const;
export const NODE_TYPE_CHOOSER = 1 as const;
export const NODE_TYPE_HOLDER = 2 as const;
export type NodeType = typeof NODE_TYPE_REGULAR | typeof NODE_TYPE_CHOOSER | typeof NODE_TYPE_HOLDER;

export const nodeTypeLabel: Record<NodeType, string> = {
  [NODE_TYPE_REGULAR]: 'regular',
  [NODE_TYPE_CHOOSER]: 'chooser',
  [NODE_TYPE_HOLDER]: 'holder',
};

export function parseNodeType(s: string): NodeType {
  switch (s.toLowerCase()) {
    case 'chooser': case '1': return NODE_TYPE_CHOOSER;
    case 'holder': case '2': return NODE_TYPE_HOLDER;
    default: return NODE_TYPE_REGULAR;
  }
}

// ── Edge Types ──────────────────────────────────────────────
export const EDGE_TYPE_IMPLICATION = 0 as const;
export const EDGE_TYPE_DERIVATION = 1 as const;
export const EDGE_TYPE_POSSIBILITY = 2 as const;
export type EdgeType = typeof EDGE_TYPE_IMPLICATION | typeof EDGE_TYPE_DERIVATION | typeof EDGE_TYPE_POSSIBILITY;

export const edgeTypeLabel: Record<EdgeType, string> = {
  [EDGE_TYPE_IMPLICATION]: 'implication',
  [EDGE_TYPE_DERIVATION]: 'derivation',
  [EDGE_TYPE_POSSIBILITY]: 'possibility',
};

export function parseEdgeType(s: string): EdgeType {
  switch (s.toLowerCase()) {
    case 'derivation': case '1': return EDGE_TYPE_DERIVATION;
    case 'possibility': case '2': return EDGE_TYPE_POSSIBILITY;
    default: return EDGE_TYPE_IMPLICATION;
  }
}

// ── Trust Combo Values (from utils.cpp:44-53) ──────────────
// Items 0–6 map to: -1, 0, 0.2, 0.4, 0.6, 0.8, 1.0
export const TRUST_LABELS = [
  'Not Classified',
  'Falsified',
  'Very Low',
  'Low',
  'Medium',
  'High',
  'Logic Deduction',
] as const;

export function trustItem2float(item: number): number {
  if (item === 0) return -1;
  return (item - 1) / 5;
}

export function float2TrustItem(trust: number): number {
  if (trust < 0) return 0;
  return Math.round(trust * 5) + 1;
}

// ── Category ────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  color: string; // hex color e.g. "#00FF00"
  description: string;
}

// ── Graph Node ──────────────────────────────────────────────
export interface GraphNode {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  keywords: string[];
  type: NodeType;
  trust: number; // -1 = unclassified, 0..1 = trust level
  referenceIds: string[];
  provenance?: Provenance;
  reviewStatus?: ReviewStatus;
  lastReviewedAt?: string;
  status?: NodeStatus;
}

// ── Graph Edge ──────────────────────────────────────────────
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  trust: number; // -1 = unclassified, 0..1
  type: EdgeType;
  combinedTrust: number; // computed: parent.trust * edge.trust
  provenance?: Provenance;
}

// ── Graph Prefix ────────────────────────────────────────────
export type GraphPrefix = 'P' | 'M';

// ── Full Graph Data (serialized) ────────────────────────────
export interface GraphData {
  version: number;
  prefix: GraphPrefix;
  rootId: string;
  lastNodeNumber: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: Category[];
  references: Reference[];
  metadata?: {
    schemaVersion?: number;
    lastAgentRun?: string;
    lastAgentRunId?: string;
    totalAgentRuns?: number;
  };
}

// ── Layout Direction ────────────────────────────────────────
export type RankDir = 'TB' | 'LR';

// ── Interaction Modes ───────────────────────────────────────
export type InteractionMode =
  | 'normal'
  | 'add-node'
  | 'add-edge-source'
  | 'add-edge-target'
  | 'delete-node'
  | 'delete-edge';

// ── Provenance & Review ─────────────────────────────────────
export type ProvenanceSource = 'human' | 'agent';

export interface Provenance {
  source: ProvenanceSource;
  agent?: string;
  timestamp: string; // ISO 8601
  runId?: string;
  searchQuery?: string;
  apiSource?: string;
  aiClassification?: 'in-scope-core' | 'in-scope-adjacent' | 'out-of-scope';
  mappingConfidence?: number; // 0-1
}

export type ReviewStatus = 'draft' | 'pending-review' | 'approved' | 'rejected';
export type NodeStatus = 'active' | 'stale' | 'merged';

// ── Reference ───────────────────────────────────────────────
export interface Reference {
  id: string;
  title: string;
  authors: string[];
  year: number;
  publication: string;
  publisher: string;
  citation: string; // full citation string
  pageStart: number;
  pageEnd: number;
  volume: number;
  description: string;
  doi: string;
  url: string;
  semanticScholarId: string;
  openAlexId: string;
  abstract: string;
  abstractChecksum?: string;
  discoveryCandidateId?: string;
  processingStatus?: 'imported-draft' | 'approved' | 'rejected';
  provenance?: Provenance;
  reviewStatus?: ReviewStatus;
}

// ── Graph Filter / Focus / Cluster State ────────────────────
export interface GraphFilterState {
  visibleCategories: Set<string>;
  edgeTrustThreshold: number; // 0.0–1.0; edges below this are hidden
  sourceApiFilter: Set<string>; // e.g. 'semantic-scholar', 'openalex', 'crossref', 'human'
  dateRange: { from: string | null; to: string | null }; // ISO date strings
  nodeTypeFilter: Set<NodeType>;
  reviewStatusFilter: Set<ReviewStatus>;
  recentChangeDays: number; // 0 = disabled
}

export interface FocusModeState {
  enabled: boolean;
  centerId: string | null;
  hops: number; // 1–5
}

export interface ClusterState {
  collapsedClusters: Set<string>; // category IDs that are collapsed
}

export interface ClusterBounds {
  categoryId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Default Categories (from legacy cats.mpsi) ──────────────
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'general', name: 'General Aspects of Psi', color: '#000000', description: '' },
  { id: 'bio', name: 'Fisiological Aspects of Psi', color: '#00FF00', description: '' },
  { id: 'physical', name: 'Physical Aspects of Psi', color: '#0000FF', description: '' },
  { id: 'psichological', name: 'Psychological Aspects of Psi', color: '#FF0000', description: '' },
  { id: 'cultural', name: 'Cultural Aspects of Psi', color: '#00FFFF', description: '' },
  { id: 'na', name: 'N/C', color: '#B4B4B4', description: '' },
];
