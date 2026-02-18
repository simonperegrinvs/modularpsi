import { trustToHex } from '../../lib/colors';

const LEGEND_STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

export function Legend() {
  return (
    <div className="flex items-center gap-1 p-2 bg-white border-t border-gray-200 text-xs text-gray-600">
      <span className="mr-1 font-medium">Trust:</span>
      <span
        className="w-5 h-4 border border-gray-300 inline-block"
        style={{ backgroundColor: trustToHex(-1) }}
        title="Unclassified"
      />
      <span className="mr-2">N/C</span>
      {LEGEND_STEPS.map((t) => (
        <span
          key={t}
          className="w-5 h-4 inline-block border border-gray-200"
          style={{ backgroundColor: trustToHex(t) }}
          title={`Trust: ${t.toFixed(1)}`}
        />
      ))}
      <span className="ml-1">0.0 (Red) → 0.5 (Yellow) → 1.0 (Blue)</span>
    </div>
  );
}
