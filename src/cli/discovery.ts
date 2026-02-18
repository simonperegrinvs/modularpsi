import type { GraphNode, Reference } from '../domain/types';

export interface DiscoveredWork {
  title: string;
  authors: string[];
  year: number;
  abstract?: string;
  doi?: string;
  url?: string;
  sourceApis: string[];
  externalIds: {
    doi?: string;
    openAlex?: string;
    semanticScholar?: string;
    arxiv?: string;
  };
  citationCount?: number;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeDoi(doi?: string): string | undefined {
  if (!doi) return undefined;
  const cleaned = doi.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  return cleaned || undefined;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseOpenAlexAbstract(inverted?: Record<string, number[]>): string {
  if (!inverted) return '';
  const entries = Object.entries(inverted);
  if (entries.length === 0) return '';
  const maxIndex = Math.max(...entries.flatMap(([, idxs]) => idxs));
  const words = Array.from({ length: maxIndex + 1 }, () => '');
  for (const [word, indexes] of entries) {
    for (const idx of indexes) words[idx] = word;
  }
  return cleanText(words.join(' '));
}

export function dedupeDiscoveredWorks(works: DiscoveredWork[]): DiscoveredWork[] {
  const byDoi = new Map<string, DiscoveredWork>();
  const byTitleYear = new Map<string, DiscoveredWork>();

  for (const item of works) {
    const doi = normalizeDoi(item.doi);
    const titleYearKey = `${normalizeTitle(item.title)}::${item.year || 0}`;

    if (doi && byDoi.has(doi)) {
      const existing = byDoi.get(doi)!;
      const merged = mergeWorks(existing, item);
      byDoi.set(doi, merged);
      for (const [k, v] of byTitleYear.entries()) {
        if (v === existing) byTitleYear.set(k, merged);
      }
      byTitleYear.set(titleYearKey, merged);
      continue;
    }

    if (byTitleYear.has(titleYearKey)) {
      const existing = byTitleYear.get(titleYearKey)!;
      const merged = mergeWorks(existing, item);
      byTitleYear.set(titleYearKey, merged);
      if (doi) byDoi.set(doi, merged);
      continue;
    }

    const normalized: DiscoveredWork = {
      ...item,
      doi,
      title: cleanText(item.title),
      abstract: item.abstract ? cleanText(item.abstract) : undefined,
      sourceApis: [...new Set(item.sourceApis)],
    };
    if (doi) byDoi.set(doi, normalized);
    byTitleYear.set(titleYearKey, normalized);
  }

  return [...new Set(byTitleYear.values())];
}

function mergeWorks(a: DiscoveredWork, b: DiscoveredWork): DiscoveredWork {
  const merged: DiscoveredWork = {
    ...a,
    title: a.title.length >= b.title.length ? a.title : b.title,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    year: a.year || b.year,
    abstract: (a.abstract && a.abstract.length >= (b.abstract?.length ?? 0)) ? a.abstract : b.abstract,
    doi: normalizeDoi(a.doi) ?? normalizeDoi(b.doi),
    url: a.url ?? b.url,
    sourceApis: [...new Set([...(a.sourceApis ?? []), ...(b.sourceApis ?? [])])],
    externalIds: { ...a.externalIds, ...b.externalIds },
    citationCount: Math.max(a.citationCount ?? 0, b.citationCount ?? 0),
  };
  return merged;
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function mapWorkToNode(work: DiscoveredWork, nodes: GraphNode[]): { nodeId?: string; confidence: number } {
  const workText = `${work.title} ${work.abstract ?? ''}`;
  const workTokens = tokenize(workText);
  let best = { nodeId: undefined as string | undefined, confidence: 0 };

  for (const node of nodes) {
    const nodeText = `${node.name} ${node.description} ${(node.keywords ?? []).join(' ')}`;
    const score = jaccard(workTokens, tokenize(nodeText));
    if (score > best.confidence) {
      best = { nodeId: node.id, confidence: score };
    }
  }

  return best;
}

export function workToReference(work: DiscoveredWork, generatedId: string, mappingConfidence: number): Reference {
  return {
    id: generatedId,
    title: work.title,
    authors: work.authors,
    year: work.year || 0,
    publication: '',
    publisher: '',
    citation: '',
    pageStart: 0,
    pageEnd: 0,
    volume: 0,
    doi: normalizeDoi(work.doi),
    url: work.url,
    abstract: work.abstract,
    studyType: 'observational',
    domainTags: [],
    qualityScore: undefined,
    effectDirection: 'mixed',
    replicationStatus: 'single',
    sourceApis: work.sourceApis,
    externalIds: work.externalIds,
    ingestedAt: new Date().toISOString(),
    aiSummary: work.abstract ? work.abstract.slice(0, 280) : '',
    aiConfidence: undefined,
    mappingConfidence,
    sourceAliases: [work.externalIds.openAlex, work.externalIds.semanticScholar, work.externalIds.arxiv].filter(Boolean) as string[],
  };
}
