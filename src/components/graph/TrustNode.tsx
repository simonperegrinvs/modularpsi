import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GraphNode } from '../../domain/types';
import { NODE_TYPE_REGULAR } from '../../domain/types';
import { trustToHex, trustToTextColor } from '../../lib/colors';

export type TrustNodeData = {
  graphNode: GraphNode;
  categoryColor: string;
  selected: boolean;
  recentlyChanged?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
};

function TrustNodeComponent({ data }: NodeProps & { data: TrustNodeData }) {
  const { graphNode, categoryColor, selected, recentlyChanged, nodeWidth, nodeHeight } = data;
  const fillColor = trustToHex(graphNode.trust);
  const textColor = trustToTextColor(graphNode.trust);
  const isEllipse = graphNode.type === NODE_TYPE_REGULAR;

  const width = nodeWidth ?? 140;
  const height = nodeHeight ?? 48;

  let boxShadow: string | undefined;
  if (recentlyChanged) {
    boxShadow = '0 0 8px 3px #f59e0b, 0 0 0 2px #f59e0b88';
  } else if (selected) {
    boxShadow = '0 0 0 2px #8080FF44';
  }

  return (
    <div
      className="flex items-center justify-center text-center px-3 py-2 cursor-pointer"
      style={{
        width,
        height,
        minWidth: width,
        minHeight: height,
        background: fillColor,
        color: textColor,
        border: `3px solid ${selected ? '#8080FF' : categoryColor}`,
        borderRadius: isEllipse ? '50%' : '12px',
        fontSize: '12px',
        fontWeight: 500,
        boxShadow,
        animation: recentlyChanged ? 'pulse-glow 2s ease-in-out infinite' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <span className="leading-tight">{graphNode.name}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

export const TrustNode = memo(TrustNodeComponent);
