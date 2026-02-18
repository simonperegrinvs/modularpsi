import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import { useGraphStore } from '../../store/graph-store';
import { TrustNode, type TrustNodeData } from './TrustNode';
import { TrustEdge, type TrustEdgeData } from './TrustEdge';
import { ClusterNode, type ClusterNodeData } from './ClusterNode';
import { trustToHex } from '../../lib/colors';

const nodeTypes = { trust: TrustNode, cluster: ClusterNode };
const edgeTypes = { trust: TrustEdge };

export function GraphCanvas() {
  const visibleNodes = useGraphStore((s) => s.visibleNodes);
  const visibleEdges = useGraphStore((s) => s.visibleEdges);
  const categories = useGraphStore((s) => s.categories);
  const nodePositions = useGraphStore((s) => s.nodePositions);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const mode = useGraphStore((s) => s.mode);
  const edgeSourceId = useGraphStore((s) => s.edgeSourceId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const addNode = useGraphStore((s) => s.addNode);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const addEdge = useGraphStore((s) => s.addEdge);
  const deleteEdge = useGraphStore((s) => s.deleteEdge);
  const setMode = useGraphStore((s) => s.setMode);
  const setEdgeSource = useGraphStore((s) => s.setEdgeSource);
  const updateNodePosition = useGraphStore((s) => s.updateNodePosition);
  const clusterBounds = useGraphStore((s) => s.clusterBounds);
  const recentChangeIds = useGraphStore((s) => s.recentChangeIds);
  const nodeSizes = useGraphStore((s) => s.nodeSizes);

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) map.set(cat.id, cat.color);
    return map;
  }, [categories]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) map.set(cat.id, cat.name);
    return map;
  }, [categories]);

  // Convert domain nodes → React Flow nodes
  const rfNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];

    // Add cluster boundary nodes (behind real nodes)
    for (const bounds of clusterBounds) {
      nodes.push({
        id: `cluster-${bounds.categoryId}`,
        type: 'cluster',
        position: { x: bounds.x, y: bounds.y },
        draggable: false,
        selectable: false,
        zIndex: -1,
        data: {
          categoryId: bounds.categoryId,
          categoryName: categoryNameMap.get(bounds.categoryId) ?? bounds.categoryId,
          categoryColor: categoryColorMap.get(bounds.categoryId) ?? '#888888',
          collapsed: false,
          nodeCount: 0,
          width: bounds.width,
          height: bounds.height,
        } satisfies ClusterNodeData,
      });
    }

    // Add real nodes
    for (const n of visibleNodes) {
      const pos = nodePositions.get(n.id) ?? { x: 0, y: 0 };
      const size = nodeSizes.get(n.id);
      nodes.push({
        id: n.id,
        type: 'trust',
        position: pos,
        data: {
          graphNode: n,
          categoryColor: categoryColorMap.get(n.categoryId) ?? '#000000',
          selected: n.id === selectedNodeId,
          recentlyChanged: recentChangeIds.has(n.id),
          nodeWidth: size?.width,
          nodeHeight: size?.height,
        } satisfies TrustNodeData,
      });
    }

    return nodes;
  }, [visibleNodes, nodePositions, selectedNodeId, categoryColorMap, categoryNameMap, clusterBounds, recentChangeIds, nodeSizes]);

  // Convert domain edges → React Flow edges
  const rfEdges: Edge[] = useMemo(
    () =>
      visibleEdges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        type: 'trust',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        data: {
          graphEdge: e,
          selected: e.id === selectedEdgeId,
        } satisfies TrustEdgeData,
      })),
    [visibleEdges, selectedEdgeId],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Ignore clicks on cluster nodes for interaction modes
      if (node.id.startsWith('cluster-')) return;

      switch (mode) {
        case 'normal':
          selectNode(node.id);
          break;
        case 'add-node':
          addNode(node.id);
          setMode('normal');
          break;
        case 'add-edge-source':
          setEdgeSource(node.id);
          setMode('add-edge-target');
          break;
        case 'add-edge-target':
          if (edgeSourceId && edgeSourceId !== node.id) {
            addEdge(edgeSourceId, node.id);
          }
          setEdgeSource(null);
          setMode('normal');
          break;
        case 'delete-node': {
          deleteNode(node.id);
          setMode('normal');
          break;
        }
        default:
          selectNode(node.id);
      }
    },
    [mode, edgeSourceId, selectNode, addNode, deleteNode, addEdge, setMode, setEdgeSource],
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (mode === 'delete-edge') {
        deleteEdge(edge.id);
        setMode('normal');
      } else {
        selectEdge(edge.id);
      }
    },
    [mode, selectEdge, deleteEdge, setMode],
  );

  const onNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.id.startsWith('cluster-')) return;
      updateNodePosition(node.id, node.position.x, node.position.y);
    },
    [updateNodePosition],
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as TrustNodeData;
            return trustToHex(data?.graphNode?.trust ?? -1);
          }}
          style={{ width: 120, height: 80 }}
        />
      </ReactFlow>
    </div>
  );
}
