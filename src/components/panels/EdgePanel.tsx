import { useGraphStore } from '../../store/graph-store';
import { EDGE_TYPES, edgeTypeLabel, TRUST_LABELS, float2TrustItem, trustItem2float } from '../../domain/types';
import type { EdgeType } from '../../domain/types';
import { trustToHex } from '../../lib/colors';

export function EdgePanel() {
  const edges = useGraphStore((s) => s.edges);
  const nodes = useGraphStore((s) => s.nodes);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const updateEdge = useGraphStore((s) => s.updateEdge);

  const edge = edges.find((e) => e.id === selectedEdgeId);

  if (!edge) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Select an edge to edit its properties.
      </div>
    );
  }

  const sourceNode = nodes.find((n) => n.id === edge.sourceId);
  const targetNode = nodes.find((n) => n.id === edge.targetId);
  const trustItem = float2TrustItem(edge.trust);

  return (
    <div className="p-4 space-y-4 text-sm">
      <h3 className="font-semibold text-base">Edge: {edge.id}</h3>

      {/* Source → Target */}
      <div className="text-gray-600">
        <span className="font-medium">{sourceNode?.name ?? edge.sourceId}</span>
        {' → '}
        <span className="font-medium">{targetNode?.name ?? edge.targetId}</span>
      </div>

      {/* Trust */}
      <label className="block">
        <span className="text-gray-600">Trust</span>
        <select
          className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={trustItem}
          onChange={(e) => {
            const newTrust = trustItem2float(parseInt(e.target.value));
            updateEdge(edge.id, { trust: newTrust });
          }}
        >
          {TRUST_LABELS.map((label, i) => (
            <option key={i} value={i}>
              {label} ({trustItem2float(i).toFixed(1)})
            </option>
          ))}
        </select>
      </label>

      {/* Trust color preview */}
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Color:</span>
        <span
          className="w-8 h-4 border border-gray-300 inline-block"
          style={{ backgroundColor: trustToHex(edge.trust) }}
        />
        <span className="text-xs text-gray-500">{edge.trust < 0 ? 'N/C' : edge.trust.toFixed(2)}</span>
      </div>

      {/* Edge Type */}
      <label className="block">
        <span className="text-gray-600">Type</span>
        <select
          className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={edge.type}
          onChange={(e) => updateEdge(edge.id, { type: parseInt(e.target.value) as EdgeType })}
        >
          {EDGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {edgeTypeLabel[t]}
            </option>
          ))}
        </select>
      </label>

      {/* Combined trust */}
      <div className="text-gray-500 text-xs">
        Combined trust: {edge.combinedTrust < 0 ? 'N/C' : edge.combinedTrust.toFixed(4)}
      </div>
    </div>
  );
}
