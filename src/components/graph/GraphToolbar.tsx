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

export function GraphToolbar({ onToggleFilters, filtersOpen }: { onToggleFilters?: () => void; filtersOpen?: boolean }) {
  const currentMode = useGraphStore((s) => s.mode);
  const setMode = useGraphStore((s) => s.setMode);
  const rankDir = useGraphStore((s) => s.rankDir);
  const setRankDir = useGraphStore((s) => s.setRankDir);
  const filters = useGraphStore((s) => s.filters);
  const focusMode = useGraphStore((s) => s.focusMode);

  const activeFilterCount =
    (filters.visibleCategories.size > 0 ? 1 : 0) +
    (filters.edgeTrustThreshold > 0 ? 1 : 0) +
    (filters.sourceApiFilter.size > 0 ? 1 : 0) +
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    (filters.nodeTypeFilter.size > 0 ? 1 : 0) +
    (filters.reviewStatusFilter.size > 0 ? 1 : 0) +
    (filters.recentChangeDays > 0 ? 1 : 0) +
    (focusMode.enabled ? 1 : 0);

  return (
    <div className="flex items-center gap-1 p-2 bg-white border-b border-gray-200">
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

      {onToggleFilters && (
        <>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={onToggleFilters}
            title="Toggle filter panel"
            className={`px-3 py-1.5 text-sm rounded border transition-colors relative ${
              filtersOpen
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
