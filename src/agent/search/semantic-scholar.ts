import type { LiteratureSearchResult, SearchOptions } from './types';

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';
const FIELDS = 'title,authors,year,externalIds,abstract,url,citationCount';

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const resp = await fetch(url);
    if (resp.ok) return resp;
    if (resp.status === 429) {
      // Rate limited — wait and retry
      const wait = delayMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (i === retries - 1) {
      throw new Error(`Semantic Scholar API error: ${resp.status} ${resp.statusText}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Semantic Scholar: max retries exceeded');
}

export async function searchSemanticScholar(opts: SearchOptions): Promise<LiteratureSearchResult[]> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const params = new URLSearchParams({
    query: opts.query,
    limit: String(limit),
    offset: String(offset),
    fields: FIELDS,
  });
  if (opts.yearMin || opts.yearMax) {
    const min = opts.yearMin ?? '';
    const max = opts.yearMax ?? '';
    params.set('year', `${min}-${max}`);
  }

  const resp = await fetchWithRetry(`${BASE_URL}/paper/search?${params}`);
  const json = await resp.json() as {
    data?: Array<{
      paperId: string;
      title: string;
      authors: Array<{ name: string }>;
      year: number | null;
      externalIds?: { DOI?: string; ArXiv?: string };
      abstract?: string;
      url?: string;
      citationCount?: number;
    }>;
  };

  if (!json.data) return [];

  return json.data.map((p) => ({
    title: p.title ?? '',
    authors: (p.authors ?? []).map((a) => a.name),
    year: p.year ?? 0,
    doi: p.externalIds?.DOI,
    abstract: p.abstract ?? undefined,
    url: p.url ?? undefined,
    semanticScholarId: p.paperId,
    citationCount: p.citationCount ?? 0,
    source: 'semantic-scholar' as const,
  }));
}

export async function resolveByDoi(doi: string): Promise<LiteratureSearchResult | null> {
  try {
    const resp = await fetchWithRetry(`${BASE_URL}/paper/DOI:${encodeURIComponent(doi)}?fields=${FIELDS}`);
    const p = await resp.json() as {
      paperId: string;
      title: string;
      authors: Array<{ name: string }>;
      year: number | null;
      externalIds?: { DOI?: string };
      abstract?: string;
      url?: string;
      citationCount?: number;
    };
    return {
      title: p.title ?? '',
      authors: (p.authors ?? []).map((a) => a.name),
      year: p.year ?? 0,
      doi: p.externalIds?.DOI ?? doi,
      abstract: p.abstract ?? undefined,
      url: p.url ?? undefined,
      semanticScholarId: p.paperId,
      citationCount: p.citationCount ?? 0,
      source: 'semantic-scholar',
    };
  } catch {
    return null;
  }
}

export async function getCitations(
  paperId: string,
  direction: 'citing' | 'cited-by',
  limit = 20,
): Promise<LiteratureSearchResult[]> {
  const endpoint = direction === 'citing' ? 'citations' : 'references';
  const resp = await fetchWithRetry(
    `${BASE_URL}/paper/${paperId}/${endpoint}?fields=${FIELDS}&limit=${limit}`,
  );
  const json = await resp.json() as {
    data?: Array<{
      citingPaper?: { paperId: string; title: string; authors: Array<{ name: string }>; year: number | null; externalIds?: { DOI?: string }; abstract?: string; url?: string; citationCount?: number };
      citedPaper?: { paperId: string; title: string; authors: Array<{ name: string }>; year: number | null; externalIds?: { DOI?: string }; abstract?: string; url?: string; citationCount?: number };
    }>;
  };

  if (!json.data) return [];

  return json.data
    .map((item) => {
      const p = direction === 'citing' ? item.citingPaper : item.citedPaper;
      if (!p) return null;
      return {
        title: p.title ?? '',
        authors: (p.authors ?? []).map((a) => a.name),
        year: p.year ?? 0,
        doi: p.externalIds?.DOI,
        abstract: p.abstract ?? undefined,
        url: p.url ?? undefined,
        semanticScholarId: p.paperId,
        citationCount: p.citationCount ?? 0,
        source: 'semantic-scholar' as const,
      };
    })
    .filter((r): r is LiteratureSearchResult => r !== null);
}
