import type { EdgeType } from '../../domain/types';
import {
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_DERIVATION,
  EDGE_TYPE_FAILS_WHEN,
  EDGE_TYPE_IMPLICATION,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_POSSIBILITY,
  EDGE_TYPE_REQUIRES,
} from '../../domain/types';

export function edgeDashPattern(type: EdgeType): string | undefined {
  switch (type) {
    case EDGE_TYPE_IMPLICATION:
      return undefined; // solid
    case EDGE_TYPE_DERIVATION:
      return '8 4 2 4'; // dash-dot
    case EDGE_TYPE_POSSIBILITY:
      return '6 4'; // dashed
    case EDGE_TYPE_REQUIRES:
      return '10 3'; // long dash
    case EDGE_TYPE_CONFOUNDED_BY:
      return '2 4'; // dotted
    case EDGE_TYPE_INCOMPATIBLE_WITH:
      return '10 3 2 3'; // long dash + dot
    case EDGE_TYPE_FAILS_WHEN:
      return '1 3'; // dense dots
    default:
      return undefined;
  }
}
