/** Simple YAML frontmatter parser/serializer for Obsidian notes */

export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yaml = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: string | string[] | number = line.slice(colonIdx + 1).trim();

    // Handle arrays: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key] = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Handle numbers
    const num = Number(value);
    if (!isNaN(num) && value !== '') {
      frontmatter[key] = num;
      continue;
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

export function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => `"${v}"`).join(', ')}]`);
    } else if (typeof value === 'string' && (value.includes(':') || value.includes('#') || value.includes('"'))) {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
