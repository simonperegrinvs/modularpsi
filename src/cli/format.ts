/**
 * Output formatters for CLI: --json (default), --table, --quiet
 */

export type OutputFormat = 'json' | 'table' | 'quiet';

export function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'quiet':
      if (Array.isArray(data)) {
        return data.map((item) => (typeof item === 'object' && item !== null && 'id' in item ? item.id : String(item))).join('\n');
      }
      return typeof data === 'object' && data !== null && 'id' in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).id)
        : String(data);
    case 'table':
      return formatTable(data);
  }
}

function formatTable(data: unknown): string {
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${formatValue(v)}`)
        .join('\n');
    }
    return String(data);
  }

  if (data.length === 0) return '(empty)';

  // Get all keys from first item
  const keys = Object.keys(data[0] as Record<string, unknown>);
  const widths = keys.map((k) =>
    Math.max(k.length, ...data.map((row) => formatValue((row as Record<string, unknown>)[k]).length)),
  );

  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  ');
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');
  const rows = data.map((row) =>
    keys.map((k, i) => formatValue((row as Record<string, unknown>)[k]).padEnd(widths[i])).join('  '),
  );

  return [header, separator, ...rows].join('\n');
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}
