import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useGraphStore } from '../../store/graph-store';

export type ClusterNodeData = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  collapsed: boolean;
  nodeCount: number;
  width: number;
  height: number;
};

function ClusterNodeComponent({ data }: NodeProps & { data: ClusterNodeData }) {
  const { categoryId, categoryName, categoryColor, collapsed, nodeCount, width, height } = data;
  const toggleClusterCollapse = useGraphStore((s) => s.toggleClusterCollapse);

  const bgColor = categoryColor + '1A'; // 10% opacity hex

  return (
    <div
      onClick={() => toggleClusterCollapse(categoryId)}
      className="cursor-pointer"
      style={{
        width,
        height,
        background: bgColor,
        border: `2px dashed ${categoryColor}`,
        borderRadius: '16px',
        position: 'relative',
      }}
    >
      <div
        className="absolute top-2 left-3 text-xs font-semibold select-none"
        style={{ color: categoryColor }}
      >
        {collapsed ? `${categoryName} (${nodeCount} nodes)` : categoryName}
      </div>
    </div>
  );
}

export const ClusterNode = memo(ClusterNodeComponent);
