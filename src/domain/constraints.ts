import type { EdgeType, GraphEdge } from './types';
import {
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_FAILS_WHEN,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_REQUIRES,
} from './types';

const CONSTRAINT_TYPES = new Set<EdgeType>([
  EDGE_TYPE_REQUIRES,
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_FAILS_WHEN,
]);

export function isConstraintEdgeType(type: EdgeType): boolean {
  return CONSTRAINT_TYPES.has(type);
}

export function isConstraintEdge(edge: GraphEdge): boolean {
  return isConstraintEdgeType(edge.type);
}
