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
import { trustToHex } from '../../lib/colors';
import { getNodeDimensions } from '../../lib/layout';
import type { GraphEdge, GraphNode, Reference } from '../../domain/types';

const nodeTypes = { trust: TrustNode };
const edgeTypes = { trust: TrustEdge };

export function GraphCanvas() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const references = useGraphStore((s) => s.references);
  const rootId = useGraphStore((s) => s.rootId);
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
  const familyFilter = useGraphStore((s) => s.familyFilter);
  const effectFilter = useGraphStore((s) => s.effectFilter);
  const studyTypeFilter = useGraphStore((s) => s.studyTypeFilter);
  const replicationFilter = useGraphStore((s) => s.replicationFilter);
  const edgeTrustThreshold = useGraphStore((s) => s.edgeTrustThreshold);
  const focusMode = useGraphStore((s) => s.focusMode);
  const focusDepth = useGraphStore((s) => s.focusDepth);
  const recentOnly = useGraphStore((s) => s.recentOnly);
  const recentDays = useGraphStore((s) => s.recentDays);

  const refById = useMemo(() => {
    const map = new Map<string, Reference>();
    for (const ref of references) map.set(ref.id, ref);
    return map;
  }, [references]);

  const incomingByTarget = useMemo(() => {
    const map = new Map<string, GraphEdge[]>();
    for (const edge of edges) {
      const arr = map.get(edge.targetId) ?? [];
      arr.push(edge);
      map.set(edge.targetId, arr);
    }
    return map;
  }, [edges]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const node of nodes) map.set(node.id, new Set());
    for (const edge of edges) {
      map.get(edge.sourceId)?.add(edge.targetId);
      map.get(edge.targetId)?.add(edge.sourceId);
    }
    return map;
  }, [nodes, edges]);

  const familyByNodeId = useMemo(() => {
    const memo = new Map<string, string>();
    const visit = (nodeId: string): string => {
      if (memo.has(nodeId)) return memo.get(nodeId)!;
      if (nodeId === rootId) {
        memo.set(nodeId, rootId);
        return rootId;
      }
      const incoming = incomingByTarget.get(nodeId) ?? [];
      if (incoming.length === 0) {
        memo.set(nodeId, nodeId);
        return nodeId;
      }
      const bestParent = [...incoming].sort((a, b) => {
        const aScore = a.combinedTrust >= 0 ? a.combinedTrust : a.trust;
        const bScore = b.combinedTrust >= 0 ? b.combinedTrust : b.trust;
        return bScore - aScore;
      })[0].sourceId;
      if (bestParent === rootId) {
        memo.set(nodeId, nodeId);
        return nodeId;
      }
      const family = visit(bestParent);
      memo.set(nodeId, family);
      return family;
    };
    for (const node of nodes) visit(node.id);
    return memo;
  }, [incomingByTarget, nodes, rootId]);

  const latestIngestedMs = useMemo(() => {
    let maxTs = -1;
    for (const ref of references) {
      if (!ref.ingestedAt) continue;
      const ts = Date.parse(ref.ingestedAt);
      if (!Number.isNaN(ts) && ts > maxTs) maxTs = ts;
    }
    return maxTs;
  }, [references]);

  const cutoffMs = useMemo(() => {
    if (latestIngestedMs < 0) return Number.POSITIVE_INFINITY;
    return latestIngestedMs - (recentDays * 24 * 60 * 60 * 1000);
  }, [latestIngestedMs, recentDays]);

  const isRecentNode = useCallback((node: GraphNode) => {
    for (const refId of node.referenceIds) {
      const ref = refById.get(refId);
      if (!ref?.ingestedAt) continue;
      const ts = Date.parse(ref.ingestedAt);
      if (!Number.isNaN(ts) && ts >= cutoffMs) return true;
    }
    return false;
  }, [cutoffMs, refById]);

  const nodePassesEvidenceFilters = useCallback((node: GraphNode) => {
    if (effectFilter === 'all' && studyTypeFilter === 'all' && replicationFilter === 'all') return true;
    const refsForNode = node.referenceIds.map((id) => refById.get(id)).filter((r): r is Reference => Boolean(r));
    if (refsForNode.length === 0) return false;
    return refsForNode.some((ref) => {
      if (effectFilter !== 'all' && ref.effectDirection !== effectFilter) return false;
      if (studyTypeFilter !== 'all' && ref.studyType !== studyTypeFilter) return false;
      if (replicationFilter !== 'all' && ref.replicationStatus !== replicationFilter) return false;
      return true;
    });
  }, [effectFilter, studyTypeFilter, replicationFilter, refById]);

  const focusSet = useMemo(() => {
    if (!focusMode || !selectedNodeId) return null;
    const visited = new Set<string>([selectedNodeId]);
    let frontier = new Set<string>([selectedNodeId]);

    for (let depth = 0; depth < focusDepth; depth += 1) {
      const next = new Set<string>();
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) ?? []) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          next.add(neighbor);
        }
      }
      frontier = next;
      if (frontier.size === 0) break;
    }
    return visited;
  }, [focusMode, selectedNodeId, focusDepth, adjacency]);

  const visibleNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (familyFilter !== 'all') {
        const family = familyByNodeId.get(node.id) ?? node.id;
        if (node.id !== rootId && family !== familyFilter) return false;
      }
      if (!nodePassesEvidenceFilters(node)) return false;
      if (recentOnly && !isRecentNode(node)) return false;
      if (focusSet && !focusSet.has(node.id)) return false;
      return true;
    });
  }, [nodes, familyFilter, familyByNodeId, rootId, nodePassesEvidenceFilters, recentOnly, isRecentNode, focusSet]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return edges.filter((edge) => {
      if (!visibleNodeIds.has(edge.sourceId) || !visibleNodeIds.has(edge.targetId)) return false;
      const effectiveTrust = edge.combinedTrust >= 0 ? edge.combinedTrust : edge.trust;
      if (effectiveTrust < edgeTrustThreshold) return false;
      return true;
    });
  }, [edges, visibleNodeIds, edgeTrustThreshold]);

  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) map.set(cat.id, cat.color);
    return map;
  }, [categories]);

  // Convert domain nodes → React Flow nodes
  const rfNodes: Node[] = useMemo(
    () =>
      visibleNodes.map((n) => {
        const pos = nodePositions.get(n.id) ?? { x: 0, y: 0 };
        const dim = getNodeDimensions(n);
        const recent = isRecentNode(n);
        return {
          id: n.id,
          type: 'trust',
          position: pos,
          style: { width: dim.width, height: dim.height },
          data: {
            graphNode: n,
            categoryColor: categoryColorMap.get(n.categoryId) ?? '#000000',
            selected: n.id === selectedNodeId,
            recent,
          } satisfies TrustNodeData,
        };
      }),
    [visibleNodes, nodePositions, selectedNodeId, categoryColorMap, isRecentNode],
  );

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
