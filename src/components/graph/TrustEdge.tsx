import { memo } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import type { GraphEdge } from '../../domain/types';
import { edgeDashPattern } from './edge-style';
import { trustToHex } from '../../lib/colors';

export type TrustEdgeData = {
  graphEdge: GraphEdge;
  selected: boolean;
};

function TrustEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps & { data: TrustEdgeData }) {
  const { graphEdge, selected } = data;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  // Edge color: trust-based if trust >= 0, otherwise black
  const color = graphEdge.trust >= 0 ? trustToHex(graphEdge.trust) : '#000000';
  const selectedColor = '#8080FF';

  // Dash pattern based on edge type, including constraint semantics.
  const strokeDasharray = edgeDashPattern(graphEdge.type);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: selected ? selectedColor : color,
        strokeWidth: selected ? 3 : 2,
        strokeDasharray,
      }}
    />
  );
}

export const TrustEdge = memo(TrustEdgeComponent);
