import { useState, useEffect } from 'react';
import { useGraphStore } from '../../store/graph-store';
import { nodeTypeLabel, TRUST_LABELS, float2TrustItem } from '../../domain/types';
import type { NodeType } from '../../domain/types';
import { trustToHex } from '../../lib/colors';
import { ReferenceList } from '../references/ReferenceList';
import { ReferenceDialog } from '../references/ReferenceDialog';

export function NodePanel() {
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const categories = useGraphStore((s) => s.categories);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const updateNode = useGraphStore((s) => s.updateNode);

  const node = nodes.find((n) => n.id === selectedNodeId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsStr, setKeywordsStr] = useState('');

  // Sync local form state when selected node changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (node) {
      setName(node.name);
      setDescription(node.description);
      setKeywordsStr(node.keywords.join('; '));
    }
  }, [node?.id, node?.name, node?.description, node?.keywords]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!node) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Select a node to edit its properties.
      </div>
    );
  }

  const outgoing = edges.filter((e) => e.sourceId === node.id);
  const incoming = edges.filter((e) => e.targetId === node.id);
  const trustItem = float2TrustItem(node.trust);
  const descriptionReady = description.trim().length > 0;
  const keywordCount = keywordsStr.split(';').map((k) => k.trim()).filter(Boolean).length;
  const refCount = node.referenceIds.length;
  const completenessParts = [descriptionReady, keywordCount > 0, refCount > 0];
  const completenessPct = Math.round((completenessParts.filter(Boolean).length / completenessParts.length) * 100);

  function commit() {
    updateNode(node!.id, {
      name,
      description,
      keywords: keywordsStr.split(';').map((k) => k.trim()).filter(Boolean),
    });
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      <h3 className="font-semibold text-base">Node: {node.id}</h3>

      {/* Trust indicator */}
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Trust:</span>
        <span
          className="px-2 py-0.5 rounded text-xs font-medium border"
          style={{ backgroundColor: trustToHex(node.trust), color: node.trust > 0.8 || (node.trust > 0 && node.trust < 0.3) ? '#fff' : '#000' }}
        >
          {node.trust < 0 ? 'N/C' : node.trust.toFixed(2)} ({TRUST_LABELS[trustItem]})
        </span>
      </div>

      {/* Metadata completeness */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Metadata completeness</span>
          <span className="text-xs font-medium">{completenessPct}%</span>
        </div>
        <div className="h-2 rounded bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${completenessPct}%` }}
          />
        </div>
        {!descriptionReady && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Missing description: add a short summary before linking more references.
          </div>
        )}
      </div>

      {/* Name */}
      <label className="block">
        <span className="text-gray-600">Name</span>
        <input
          className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
        />
      </label>

      {/* Description */}
      <label className="block">
        <span className="text-gray-600">Description</span>
        <textarea
          className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm h-20 resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
        />
      </label>

      {/* Category */}
      <label className="block">
        <span className="text-gray-600">Category</span>
        <select
          className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={node.categoryId}
          onChange={(e) => updateNode(node.id, { categoryId: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {/* Node Type */}
      <label className="block">
        <span className="text-gray-600">Type</span>
        <select
          className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={node.type}
          onChange={(e) => updateNode(node.id, { type: parseInt(e.target.value) as NodeType })}
        >
          {([0, 1, 2] as NodeType[]).map((t) => (
            <option key={t} value={t}>
              {nodeTypeLabel[t]}
            </option>
          ))}
        </select>
      </label>

      {/* Keywords */}
      <label className="block">
        <span className="text-gray-600">Keywords (semicolon-separated)</span>
        <input
          className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={keywordsStr}
          onChange={(e) => setKeywordsStr(e.target.value)}
          onBlur={commit}
        />
      </label>

      {/* Connections summary */}
      <div>
        <span className="text-gray-600 font-medium">Connections</span>
        <div className="mt-1 text-xs text-gray-500">
          {incoming.length} incoming, {outgoing.length} outgoing
        </div>
      </div>

      {/* References */}
      <ReferenceList nodeId={node.id} onAddRef={() => setRefDialogOpen(true)} />
      <ReferenceDialog
        open={refDialogOpen}
        onClose={() => setRefDialogOpen(false)}
        nodeId={node.id}
      />
    </div>
  );
}
