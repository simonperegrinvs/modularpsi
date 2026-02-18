import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GraphNode } from '../../domain/types';
import { NODE_TYPE_REGULAR } from '../../domain/types';
import { trustToHex, trustToTextColor } from '../../lib/colors';

export type TrustNodeData = {
  graphNode: GraphNode;
  categoryColor: string;
  selected: boolean;
};

function TrustNodeComponent({ data }: NodeProps & { data: TrustNodeData }) {
  const { graphNode, categoryColor, selected } = data;
  const fillColor = trustToHex(graphNode.trust);
  const textColor = trustToTextColor(graphNode.trust);
  const isEllipse = graphNode.type === NODE_TYPE_REGULAR;

  return (
    <div
      className="flex items-center justify-center text-center px-3 py-2 min-w-[140px] min-h-[48px] cursor-pointer"
      style={{
        background: fillColor,
        color: textColor,
        border: `3px solid ${selected ? '#8080FF' : categoryColor}`,
        borderRadius: isEllipse ? '50%' : '12px',
        fontSize: '12px',
        fontWeight: 500,
        boxShadow: selected ? '0 0 0 2px #8080FF44' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <span className="leading-tight">{graphNode.name}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

export const TrustNode = memo(TrustNodeComponent);
