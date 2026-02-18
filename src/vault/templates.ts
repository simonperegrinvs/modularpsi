import type { GraphNode, Reference, GraphData } from '../domain/types';
import { nodeTypeLabel } from '../domain/types';
import { serializeFrontmatter } from './frontmatter';

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

export function nodeFilename(node: GraphNode): string {
  return `${node.id}-${slugify(node.name)}.md`;
}

export function refFilename(ref: Reference): string {
  const authorSlug = ref.authors.length > 0
    ? slugify(ref.authors[0].split(',')[0].split(' ').pop() ?? '')
    : 'unknown';
  return `${ref.id}-${authorSlug}-${ref.year}.md`;
}

export function generateNodeNote(node: GraphNode, data: GraphData): string {
  const linkedRefs = data.references.filter((r) => node.referenceIds.includes(r.id));
  const incomingEdges = data.edges.filter((e) => e.targetId === node.id);
  const outgoingEdges = data.edges.filter((e) => e.sourceId === node.id);
  const parentNodes = incomingEdges.map((e) => data.nodes.find((n) => n.id === e.sourceId)).filter(Boolean);
  const childNodes = outgoingEdges.map((e) => data.nodes.find((n) => n.id === e.targetId)).filter(Boolean);

  const fm: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    category: node.categoryId,
    type: nodeTypeLabel[node.type],
    trust: node.trust,
    keywords: node.keywords,
    referenceIds: node.referenceIds,
  };
  if (node.reviewStatus) fm.reviewStatus = node.reviewStatus;
  if (node.status) fm.status = node.status;

  const sections: string[] = [
    serializeFrontmatter(fm),
    '',
    `# ${node.name}`,
    '',
  ];

  if (node.description) {
    sections.push(node.description, '');
  }

  if (linkedRefs.length > 0) {
    sections.push('## References', '');
    for (const ref of linkedRefs) {
      const fname = refFilename(ref);
      sections.push(`- [[${fname.replace('.md', '')}|${ref.authors[0]?.split(',')[0] ?? 'Unknown'} (${ref.year})]]`);
    }
    sections.push('');
  }

  if (parentNodes.length > 0 || childNodes.length > 0) {
    sections.push('## Related Nodes', '');
    for (const parent of parentNodes) {
      if (!parent) continue;
      const fname = nodeFilename(parent);
      sections.push(`- Parent: [[${fname.replace('.md', '')}|${parent.name}]]`);
    }
    for (const child of childNodes) {
      if (!child) continue;
      const edge = outgoingEdges.find((e) => e.targetId === child.id);
      const trustStr = edge ? ` (trust: ${edge.trust})` : '';
      const fname = nodeFilename(child);
      sections.push(`- Child: [[${fname.replace('.md', '')}|${child.name}]]${trustStr}`);
    }
    sections.push('');
  }

  sections.push('## Notes', '_Human annotations — preserved across syncs, never overwritten._', '');

  return sections.join('\n');
}

export function generateRefNote(ref: Reference, data: GraphData): string {
  const linkedNodes = data.nodes.filter((n) => n.referenceIds.includes(ref.id));

  const fm: Record<string, unknown> = {
    id: ref.id,
    title: ref.title,
    authors: ref.authors,
    year: ref.year,
  };
  if (ref.doi) fm.doi = ref.doi;
  if (ref.url) fm.url = ref.url;
  if (ref.reviewStatus) fm.reviewStatus = ref.reviewStatus;

  const authorStr = ref.authors.length > 0
    ? `${ref.authors[0].split(',')[0]}${ref.authors.length > 1 ? ' et al.' : ''}`
    : 'Unknown';

  const sections: string[] = [
    serializeFrontmatter(fm),
    '',
    `# ${authorStr} (${ref.year})`,
    '',
  ];

  if (ref.description) {
    sections.push(ref.description, '');
  }

  if (ref.abstract) {
    sections.push('## Abstract', '', ref.abstract, '');
  }

  if (linkedNodes.length > 0) {
    sections.push('## Linked Nodes', '');
    for (const node of linkedNodes) {
      const fname = nodeFilename(node);
      sections.push(`- [[${fname.replace('.md', '')}|${node.name}]]`);
    }
    sections.push('');
  }

  sections.push('## Reading Notes', '_Human annotations — preserved across syncs._', '');

  return sections.join('\n');
}
