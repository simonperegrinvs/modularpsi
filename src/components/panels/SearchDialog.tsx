import { useState, useMemo } from 'react';
import { useGraphStore } from '../../store/graph-store';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const nodes = useGraphStore((s) => s.nodes);
  const selectNode = useGraphStore((s) => s.selectNode);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [query, nodes]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-24 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[60vh] flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <input
            autoFocus
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Search nodes by name, description, or keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {results.length === 0 && query.trim() && (
            <div className="p-4 text-sm text-gray-500">No results found.</div>
          )}
          {results.map((n) => (
            <button
              key={n.id}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-100"
              onClick={() => {
                selectNode(n.id);
                onClose();
              }}
            >
              <span className="font-medium">{n.id}</span>{' '}
              <span className="text-gray-700">{n.name}</span>
              {n.description && (
                <span className="block text-xs text-gray-400 truncate">{n.description}</span>
              )}
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
