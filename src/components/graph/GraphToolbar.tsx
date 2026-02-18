import { useGraphStore } from '../../store/graph-store';
import { undo, redo } from '../../store/history';
import type { InteractionMode } from '../../domain/types';

const modes: { mode: InteractionMode; label: string; title: string }[] = [
  { mode: 'normal', label: 'Select', title: 'Normal selection mode' },
  { mode: 'add-node', label: '+ Node', title: 'Click a node to add a child' },
  { mode: 'add-edge-source', label: '+ Edge', title: 'Click source then target node' },
  { mode: 'delete-node', label: '- Node', title: 'Click a node to delete it' },
  { mode: 'delete-edge', label: '- Edge', title: 'Click an edge to delete it' },
];

export function GraphToolbar() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const rootId = useGraphStore((s) => s.rootId);
  const currentMode = useGraphStore((s) => s.mode);
  const setMode = useGraphStore((s) => s.setMode);
  const rankDir = useGraphStore((s) => s.rankDir);
  const setRankDir = useGraphStore((s) => s.setRankDir);
  const familyFilter = useGraphStore((s) => s.familyFilter);
  const setFamilyFilter = useGraphStore((s) => s.setFamilyFilter);
  const effectFilter = useGraphStore((s) => s.effectFilter);
  const setEffectFilter = useGraphStore((s) => s.setEffectFilter);
  const studyTypeFilter = useGraphStore((s) => s.studyTypeFilter);
  const setStudyTypeFilter = useGraphStore((s) => s.setStudyTypeFilter);
  const replicationFilter = useGraphStore((s) => s.replicationFilter);
  const setReplicationFilter = useGraphStore((s) => s.setReplicationFilter);
  const edgeTrustThreshold = useGraphStore((s) => s.edgeTrustThreshold);
  const setEdgeTrustThreshold = useGraphStore((s) => s.setEdgeTrustThreshold);
  const focusMode = useGraphStore((s) => s.focusMode);
  const setFocusMode = useGraphStore((s) => s.setFocusMode);
  const focusDepth = useGraphStore((s) => s.focusDepth);
  const setFocusDepth = useGraphStore((s) => s.setFocusDepth);
  const recentOnly = useGraphStore((s) => s.recentOnly);
  const setRecentOnly = useGraphStore((s) => s.setRecentOnly);
  const recentDays = useGraphStore((s) => s.recentDays);
  const setRecentDays = useGraphStore((s) => s.setRecentDays);

  const familyOptions = edges
    .filter((e) => e.sourceId === rootId)
    .map((e) => e.targetId)
    .map((id) => {
      const node = nodes.find((n) => n.id === id);
      return { id, label: node?.name ?? id };
    });

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-white border-b border-gray-200">
      {modes.map(({ mode, label, title }) => (
        <button
          key={mode}
          title={title}
          onClick={() => setMode(mode)}
          className={`px-3 py-1.5 text-sm rounded border transition-colors ${
            currentMode === mode
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {label}
        </button>
      ))}

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button
        onClick={undo}
        title="Undo (Ctrl+Z)"
        className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      >
        Undo
      </button>
      <button
        onClick={redo}
        title="Redo (Ctrl+Y)"
        className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      >
        Redo
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button
        onClick={() => setRankDir(rankDir === 'TB' ? 'LR' : 'TB')}
        title="Toggle layout direction"
        className="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      >
        {rankDir === 'TB' ? 'Top-Down' : 'Left-Right'}
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <label className="text-xs text-gray-600">Family</label>
      <select
        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
        value={familyFilter}
        onChange={(e) => setFamilyFilter(e.target.value)}
      >
        <option value="all">All</option>
        {familyOptions.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      <label className="text-xs text-gray-600">Effect</label>
      <select
        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
        value={effectFilter}
        onChange={(e) => setEffectFilter(e.target.value as 'all' | 'supports' | 'mixed' | 'null' | 'challenges')}
      >
        <option value="all">All</option>
        <option value="supports">Supports</option>
        <option value="mixed">Mixed</option>
        <option value="null">Null</option>
        <option value="challenges">Challenges</option>
      </select>

      <label className="text-xs text-gray-600">Study</label>
      <select
        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
        value={studyTypeFilter}
        onChange={(e) => setStudyTypeFilter(e.target.value as 'all' | 'meta-analysis' | 'rct' | 'observational' | 'theory' | 'review' | 'replication')}
      >
        <option value="all">All</option>
        <option value="meta-analysis">Meta</option>
        <option value="replication">Replication</option>
        <option value="rct">RCT</option>
        <option value="observational">Observational</option>
        <option value="review">Review</option>
        <option value="theory">Theory</option>
      </select>

      <label className="text-xs text-gray-600">Replication</label>
      <select
        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
        value={replicationFilter}
        onChange={(e) => setReplicationFilter(e.target.value as 'all' | 'single' | 'independent-replication' | 'failed-replication' | 'multi-lab')}
      >
        <option value="all">All</option>
        <option value="multi-lab">Multi-lab</option>
        <option value="independent-replication">Independent</option>
        <option value="single">Single</option>
        <option value="failed-replication">Failed</option>
      </select>

      <label className="text-xs text-gray-600">Edge ≥</label>
      <input
        type="range"
        min="-1"
        max="1"
        step="0.05"
        value={edgeTrustThreshold}
        onChange={(e) => setEdgeTrustThreshold(parseFloat(e.target.value))}
        className="w-24"
      />
      <span className="text-xs text-gray-600 w-10 text-right">{edgeTrustThreshold.toFixed(2)}</span>

      <label className="text-xs text-gray-600 flex items-center gap-1">
        <input
          type="checkbox"
          checked={focusMode}
          onChange={(e) => setFocusMode(e.target.checked)}
        />
        Focus
      </label>
      <input
        type="number"
        min={1}
        max={6}
        value={focusDepth}
        onChange={(e) => setFocusDepth(parseInt(e.target.value, 10) || 2)}
        className="w-14 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
        title="Focus depth (k hops)"
      />

      <label className="text-xs text-gray-600 flex items-center gap-1">
        <input
          type="checkbox"
          checked={recentOnly}
          onChange={(e) => setRecentOnly(e.target.checked)}
        />
        Recent
      </label>
      <input
        type="number"
        min={1}
        max={365}
        value={recentDays}
        onChange={(e) => setRecentDays(parseInt(e.target.value, 10) || 30)}
        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
        title="Recent window (days)"
      />
    </div>
  );
}
