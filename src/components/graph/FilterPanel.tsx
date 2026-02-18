import { useGraphStore } from '../../store/graph-store';
import { NODE_TYPE_REGULAR, NODE_TYPE_CHOOSER, NODE_TYPE_HOLDER } from '../../domain/types';
import type { ReviewStatus, NodeType } from '../../domain/types';

const SOURCE_OPTIONS = ['human', 'semantic-scholar', 'openalex', 'crossref'] as const;
const REVIEW_OPTIONS: ReviewStatus[] = ['draft', 'pending-review', 'approved', 'rejected'];
const NODE_TYPE_OPTIONS: Array<{ value: NodeType; label: string }> = [
  { value: NODE_TYPE_REGULAR, label: 'Regular' },
  { value: NODE_TYPE_CHOOSER, label: 'Chooser' },
  { value: NODE_TYPE_HOLDER, label: 'Holder' },
];

export function FilterPanel({ onClose }: { onClose: () => void }) {
  const categories = useGraphStore((s) => s.categories);
  const filters = useGraphStore((s) => s.filters);
  const focusMode = useGraphStore((s) => s.focusMode);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const setFilter = useGraphStore((s) => s.setFilter);
  const setEdgeTrustThreshold = useGraphStore((s) => s.setEdgeTrustThreshold);
  const toggleCategoryVisibility = useGraphStore((s) => s.toggleCategoryVisibility);
  const setFocusMode = useGraphStore((s) => s.setFocusMode);
  const setRecentChangeDays = useGraphStore((s) => s.setRecentChangeDays);

  const hasActiveFilters =
    filters.visibleCategories.size > 0 ||
    filters.edgeTrustThreshold > 0 ||
    filters.sourceApiFilter.size > 0 ||
    filters.dateRange.from !== null ||
    filters.dateRange.to !== null ||
    filters.nodeTypeFilter.size > 0 ||
    filters.reviewStatusFilter.size > 0 ||
    filters.recentChangeDays > 0 ||
    focusMode.enabled;

  function resetAll() {
    setFilter({
      visibleCategories: new Set<string>(),
      edgeTrustThreshold: 0,
      sourceApiFilter: new Set<string>(),
      dateRange: { from: null, to: null },
      nodeTypeFilter: new Set<NodeType>(),
      reviewStatusFilter: new Set<ReviewStatus>(),
      recentChangeDays: 0,
    });
    setFocusMode(null, 2);
  }

  function toggleSourceApi(src: string) {
    const newSet = new Set(filters.sourceApiFilter);
    if (newSet.has(src)) newSet.delete(src);
    else newSet.add(src);
    setFilter({ sourceApiFilter: newSet });
  }

  function toggleReviewStatus(status: ReviewStatus) {
    const newSet = new Set(filters.reviewStatusFilter);
    if (newSet.has(status)) newSet.delete(status);
    else newSet.add(status);
    setFilter({ reviewStatusFilter: newSet });
  }

  function toggleNodeType(type: NodeType) {
    const newSet = new Set(filters.nodeTypeFilter);
    if (newSet.has(type)) newSet.delete(type);
    else newSet.add(type);
    setFilter({ nodeTypeFilter: newSet });
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-3 text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">Filters</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          &times;
        </button>
      </div>

      {/* Categories */}
      <div className="mb-4">
        <div className="font-medium mb-1">Categories</div>
        {categories.map((cat) => (
          <label key={cat.id} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={filters.visibleCategories.size === 0 || filters.visibleCategories.has(cat.id)}
              onChange={() => toggleCategoryVisibility(cat.id)}
            />
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: cat.color }}
            />
            <span className="truncate">{cat.name}</span>
          </label>
        ))}
      </div>

      {/* Edge Trust Threshold */}
      <div className="mb-4">
        <div className="font-medium mb-1">
          Edge Trust &ge; {filters.edgeTrustThreshold.toFixed(2)}
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={filters.edgeTrustThreshold}
          onChange={(e) => setEdgeTrustThreshold(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Source API */}
      <div className="mb-4">
        <div className="font-medium mb-1">Source</div>
        {SOURCE_OPTIONS.map((src) => (
          <label key={src} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={filters.sourceApiFilter.size === 0 || filters.sourceApiFilter.has(src)}
              onChange={() => toggleSourceApi(src)}
            />
            <span>{src}</span>
          </label>
        ))}
      </div>

      {/* Date Range */}
      <div className="mb-4">
        <div className="font-medium mb-1">Date Range</div>
        <div className="flex gap-1">
          <input
            type="date"
            value={filters.dateRange.from ?? ''}
            onChange={(e) =>
              setFilter({ dateRange: { ...filters.dateRange, from: e.target.value || null } })
            }
            className="border rounded px-1 py-0.5 text-xs flex-1"
          />
          <input
            type="date"
            value={filters.dateRange.to ?? ''}
            onChange={(e) =>
              setFilter({ dateRange: { ...filters.dateRange, to: e.target.value || null } })
            }
            className="border rounded px-1 py-0.5 text-xs flex-1"
          />
        </div>
      </div>

      {/* Node Type */}
      <div className="mb-4">
        <div className="font-medium mb-1">Node Type</div>
        {NODE_TYPE_OPTIONS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={filters.nodeTypeFilter.size === 0 || filters.nodeTypeFilter.has(value)}
              onChange={() => toggleNodeType(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {/* Review Status */}
      <div className="mb-4">
        <div className="font-medium mb-1">Review Status</div>
        {REVIEW_OPTIONS.map((status) => (
          <label key={status} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={
                filters.reviewStatusFilter.size === 0 ||
                filters.reviewStatusFilter.has(status)
              }
              onChange={() => toggleReviewStatus(status)}
            />
            <span>{status}</span>
          </label>
        ))}
      </div>

      {/* Recent Changes */}
      <div className="mb-4">
        <div className="font-medium mb-1">
          Recent Changes: {filters.recentChangeDays > 0 ? `${filters.recentChangeDays}d` : 'off'}
        </div>
        <input
          type="range"
          min={0}
          max={90}
          step={1}
          value={filters.recentChangeDays}
          onChange={(e) => setRecentChangeDays(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Focus Mode */}
      <div className="mb-4">
        <div className="font-medium mb-1">Focus Mode</div>
        <label className="flex items-center gap-2 py-0.5">
          <input
            type="checkbox"
            checked={focusMode.enabled}
            onChange={() => {
              if (focusMode.enabled) {
                setFocusMode(null, focusMode.hops);
              } else if (selectedNodeId) {
                setFocusMode(selectedNodeId, focusMode.hops);
              }
            }}
          />
          <span>Enabled {focusMode.enabled && focusMode.centerId ? `(${focusMode.centerId})` : ''}</span>
        </label>
        {focusMode.enabled && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs">Hops:</span>
            <input
              type="number"
              min={1}
              max={5}
              value={focusMode.hops}
              onChange={(e) =>
                setFocusMode(focusMode.centerId, Math.max(1, Math.min(5, Number(e.target.value))))
              }
              className="border rounded px-1 py-0.5 text-xs w-12"
            />
          </div>
        )}
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={resetAll}
          className="w-full py-1.5 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
        >
          Reset All Filters
        </button>
      )}
    </div>
  );
}
