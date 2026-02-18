import type { LiteratureSearchResult, SearchOptions } from './types';

const BASE_URL = 'https://api.openalex.org';

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'modularpsi-literature (https://github.com/modularpsi)' },
    });
    if (resp.ok) return resp;
    if (resp.status === 429) {
      const wait = delayMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (i === retries - 1) {
      throw new Error(`OpenAlex API error: ${resp.status} ${resp.statusText}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('OpenAlex: max retries exceeded');
}

export async function searchOpenAlex(opts: SearchOptions): Promise<LiteratureSearchResult[]> {
  const limit = opts.limit ?? 20;
  const params = new URLSearchParams({
    search: opts.query,
    per_page: String(limit),
    select: 'id,title,authorships,publication_year,doi,ids,abstract_inverted_index,cited_by_count',
  });
  if (opts.yearMin) params.set('filter', `publication_year:>${opts.yearMin - 1}`);
  if (opts.yearMax) {
    const existing = params.get('filter') ?? '';
    const yearFilter = `publication_year:<${opts.yearMax + 1}`;
    params.set('filter', existing ? `${existing},${yearFilter}` : yearFilter);
  }

  const resp = await fetchWithRetry(`${BASE_URL}/works?${params}`);
  const json = await resp.json() as {
    results?: Array<{
      id: string;
      title: string;
      authorships: Array<{ author: { display_name: string } }>;
      publication_year: number | null;
      doi: string | null;
      ids?: { openalex?: string };
      abstract_inverted_index?: Record<string, number[]>;
      cited_by_count?: number;
    }>;
  };

  if (!json.results) return [];

  return json.results.map((w) => ({
    title: w.title ?? '',
    authors: (w.authorships ?? []).map((a) => a.author.display_name),
    year: w.publication_year ?? 0,
    doi: w.doi?.replace('https://doi.org/', '') ?? undefined,
    abstract: w.abstract_inverted_index ? reconstructAbstract(w.abstract_inverted_index) : undefined,
    url: w.id,
    openAlexId: w.ids?.openalex ?? w.id,
    citationCount: w.cited_by_count ?? 0,
    source: 'openalex' as const,
  }));
}

/** Reconstruct abstract from OpenAlex inverted index format */
function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  const words: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([pos, word]);
    }
  }
  words.sort((a, b) => a[0] - b[0]);
  return words.map((w) => w[1]).join(' ');
}
