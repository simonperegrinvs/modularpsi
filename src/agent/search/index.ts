import type { LiteratureSearchResult, SearchOptions } from './types';
import { searchSemanticScholar, resolveByDoi, getCitations } from './semantic-scholar';
import { searchOpenAlex } from './openalex';
import { resolveDoiCrossRef } from './crossref';

export type ApiSource = 'semantic-scholar' | 'openalex' | 'crossref';

export async function searchLiterature(
  opts: SearchOptions & { api?: ApiSource },
): Promise<LiteratureSearchResult[]> {
  const api = opts.api ?? 'semantic-scholar';
  switch (api) {
    case 'semantic-scholar':
      return searchSemanticScholar(opts);
    case 'openalex':
      return searchOpenAlex(opts);
    default:
      throw new Error(`Unsupported search API: ${api}`);
  }
}

export async function resolveDoi(doi: string): Promise<LiteratureSearchResult | null> {
  // Try Semantic Scholar first, fall back to CrossRef
  const s2 = await resolveByDoi(doi);
  if (s2) return s2;
  return resolveDoiCrossRef(doi);
}

export { getCitations } from './semantic-scholar';
export { isDuplicate } from './dedup';
export type { LiteratureSearchResult, SearchOptions } from './types';
