import { useGraphStore } from '../../store/graph-store';

interface ReferenceListProps {
  nodeId: string;
  onAddRef: () => void;
}

export function ReferenceList({ nodeId, onAddRef }: ReferenceListProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const references = useGraphStore((s) => s.references);
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) return null;

  const linked = references.filter((r) => node.referenceIds.includes(r.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-600 font-medium text-sm">References</span>
        <button
          onClick={onAddRef}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          + Add
        </button>
      </div>
      {linked.length === 0 && (
        <div className="text-xs text-gray-400">No references linked.</div>
      )}
      {linked.map((ref) => (
        <div key={ref.id} className="text-xs border border-gray-200 rounded p-2">
          <div className="font-medium">{ref.title}</div>
          {ref.authors.length > 0 && (
            <div className="text-gray-500">{ref.authors.join(', ')}</div>
          )}
          {ref.year > 0 && <div className="text-gray-500">{ref.year}</div>}
          {ref.description && <div className="text-gray-400 mt-1">{ref.description}</div>}
        </div>
      ))}
    </div>
  );
}
