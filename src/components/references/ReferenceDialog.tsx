import { useState, useMemo } from 'react';
import { useGraphStore } from '../../store/graph-store';

interface ReferenceDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
}

export function ReferenceDialog({ open, onClose, nodeId }: ReferenceDialogProps) {
  const [mode, setMode] = useState<'search' | 'add'>('search');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const references = useGraphStore((s) => s.references);
  const nodes = useGraphStore((s) => s.nodes);
  const updateNode = useGraphStore((s) => s.updateNode);
  const node = nodes.find((n) => n.id === nodeId);

  const results = useMemo(() => {
    if (!query.trim()) return references;
    const q = query.toLowerCase();
    return references.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.citation.toLowerCase().includes(q) ||
        r.authors.some((a) => a.toLowerCase().includes(q)),
    );
  }, [query, references]);

  if (!open || !node) return null;

  function linkRef(refId: string) {
    if (!node!.referenceIds.includes(refId)) {
      updateNode(nodeId, { referenceIds: [...node!.referenceIds, refId] });
    }
  }

  function handleAdd() {
    // eslint-disable-next-line react-hooks/purity
    const id = `ref-${Date.now()}`;
    // Add to store references array directly via set
    const store = useGraphStore.getState();
    useGraphStore.setState({
      references: [
        ...store.references,
        {
          id,
          title,
          authors: authors.split(';').map((a) => a.trim()).filter(Boolean),
          year: parseInt(year) || 0,
          publication: '',
          publisher: '',
          citation: '',
          pageStart: 0,
          pageEnd: 0,
          volume: 0,
        },
      ],
    });
    linkRef(id);
    setTitle('');
    setAuthors('');
    setYear('');
    setMode('search');
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-24 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[60vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <button
            onClick={() => setMode('search')}
            className={`px-3 py-1 text-sm rounded ${mode === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Search
          </button>
          <button
            onClick={() => setMode('add')}
            className={`px-3 py-1 text-sm rounded ${mode === 'add' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Add New
          </button>
        </div>

        {mode === 'search' && (
          <>
            <div className="p-4">
              <input
                autoFocus
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Search references..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && onClose()}
              />
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-4">
              {results.map((ref) => (
                <button
                  key={ref.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100"
                  onClick={() => linkRef(ref.id)}
                >
                  <span className="font-medium">{ref.title}</span>
                  {ref.year > 0 && <span className="text-gray-500 ml-2">({ref.year})</span>}
                  {node.referenceIds.includes(ref.id) && (
                    <span className="text-green-600 ml-2 text-xs">linked</span>
                  )}
                  {ref.authors.length > 0 && (
                    <span className="block text-xs text-gray-400">{ref.authors.join(', ')}</span>
                  )}
                </button>
              ))}
              {results.length === 0 && <div className="text-sm text-gray-500">No references found.</div>}
            </div>
          </>
        )}

        {mode === 'add' && (
          <div className="p-4 space-y-3">
            <label className="block">
              <span className="text-sm text-gray-600">Title</span>
              <input
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Authors (semicolon-separated)</span>
              <input
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Year</span>
              <input
                type="number"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Add & Link
            </button>
          </div>
        )}

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
