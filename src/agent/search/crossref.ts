import type { LiteratureSearchResult } from './types';

const BASE_URL = 'https://api.crossref.org/works';

async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'modularpsi-literature (https://github.com/modularpsi; mailto:noreply@modularpsi.org)' },
    });
    if (resp.ok) return resp;
    if (resp.status === 429) {
      const wait = delayMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (i === retries - 1) {
      throw new Error(`CrossRef API error: ${resp.status} ${resp.statusText}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('CrossRef: max retries exceeded');
}

export async function resolveDoiCrossRef(doi: string): Promise<LiteratureSearchResult | null> {
  try {
    const resp = await fetchWithRetry(`${BASE_URL}/${encodeURIComponent(doi)}`);
    const json = await resp.json() as {
      message?: {
        title?: string[];
        author?: Array<{ given?: string; family?: string }>;
        'published-print'?: { 'date-parts'?: number[][] };
        'published-online'?: { 'date-parts'?: number[][] };
        DOI?: string;
        URL?: string;
        abstract?: string;
        'is-referenced-by-count'?: number;
      };
    };

    const msg = json.message;
    if (!msg) return null;

    const dateParts = msg['published-print']?.['date-parts']?.[0] ?? msg['published-online']?.['date-parts']?.[0];

    return {
      title: msg.title?.[0] ?? '',
      authors: (msg.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ')),
      year: dateParts?.[0] ?? 0,
      doi: msg.DOI ?? doi,
      url: msg.URL,
      abstract: msg.abstract,
      citationCount: msg['is-referenced-by-count'] ?? 0,
      source: 'crossref',
    };
  } catch {
    return null;
  }
}
