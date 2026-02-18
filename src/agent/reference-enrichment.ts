import type { Reference } from '../domain/types';
import type { ApiSource, LiteratureSearchResult, SearchOptions } from './search';

export type TitleSearchApi = Extract<ApiSource, 'semantic-scholar' | 'openalex'>;

export interface ReferenceEnrichmentDeps {
  resolveDoi: (doi: string) => Promise<LiteratureSearchResult | null>;
  searchByTitle: (opts: SearchOptions & { api?: ApiSource }) => Promise<LiteratureSearchResult[]>;
}

export interface EnrichReferenceOptions {
  apis?: TitleSearchApi[];
  limit?: number;
}

export interface EnrichReferenceResult {
  refId: string;
  title: string;
  status: 'enriched' | 'unchanged' | 'failed';
  updatedFields: Array<'doi' | 'url' | 'abstract' | 'semanticScholarId' | 'openAlexId'>;
  usedSource?: string;
  reason?: string;
}

export interface EnrichReferencesOptions extends EnrichReferenceOptions {
  onlyMissingLocator?: boolean;
}

export interface EnrichReferencesReport {
  scanned: number;
  attempted: number;
  enriched: number;
  unchanged: number;
  failed: number;
  details: EnrichReferenceResult[];
}

const DEFAULT_APIS: TitleSearchApi[] = ['semantic-scholar', 'openalex'];

const FIELD_ORDER: Array<'doi' | 'url' | 'abstract' | 'semanticScholarId' | 'openAlexId'> = [
  'doi',
  'url',
  'abstract',
  'semanticScholarId',
  'openAlexId',
];

function trimmed(value?: string): string {
  return (value ?? '').trim();
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDoi(value: string): string {
  return value.toLowerCase().replace(/^https?:\/\/doi.org\//, '').trim();
}

function hasAnyAuthor(authors: string[] | undefined): boolean {
  return (authors ?? []).some((author) => trimmed(author).length > 0);
}

function sharedAuthorCount(a: string[], b: string[]): number {
  const left = new Set(a.map((name) => normalizeTitle(name)).filter(Boolean));
  const right = new Set(b.map((name) => normalizeTitle(name)).filter(Boolean));
  let count = 0;
  for (const name of left) {
    if (right.has(name)) count++;
  }
  return count;
}

function scoreCandidate(ref: Reference, candidate: LiteratureSearchResult): number {
  const refTitle = normalizeTitle(ref.title);
  const candidateTitle = normalizeTitle(candidate.title);
  if (!refTitle || !candidateTitle) return 0;

  let score = 0;
  if (refTitle === candidateTitle) {
    score += 0.75;
  } else if (refTitle.includes(candidateTitle) || candidateTitle.includes(refTitle)) {
    score += 0.55;
  }

  if (ref.year > 0 && candidate.year > 0) {
    const diff = Math.abs(ref.year - candidate.year);
    if (diff === 0) score += 0.2;
    else if (diff === 1) score += 0.15;
    else if (diff === 2) score += 0.05;
  }

  const overlap = sharedAuthorCount(ref.authors ?? [], candidate.authors ?? []);
  if (overlap > 0) {
    score += Math.min(0.1, overlap * 0.05);
  }

  const candidateDoi = trimmed(candidate.doi);
  if (trimmed(ref.doi) && candidateDoi && normalizeDoi(ref.doi) === normalizeDoi(candidateDoi)) {
    score += 0.3;
  }

  return score;
}

function dedupeCandidates(candidates: LiteratureSearchResult[]): LiteratureSearchResult[] {
  const seen = new Set<string>();
  const deduped: LiteratureSearchResult[] = [];
  for (const candidate of candidates) {
    const key = trimmed(candidate.doi)
      ? `doi:${normalizeDoi(candidate.doi ?? '')}`
      : trimmed(candidate.semanticScholarId)
        ? `s2:${trimmed(candidate.semanticScholarId)}`
        : trimmed(candidate.openAlexId)
          ? `oa:${trimmed(candidate.openAlexId)}`
          : `title:${normalizeTitle(candidate.title)}:${candidate.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function isStrongTitleMatch(ref: Reference, candidate: LiteratureSearchResult): boolean {
  return scoreCandidate(ref, candidate) >= 0.72;
}

function pickBestCandidate(ref: Reference, candidates: LiteratureSearchResult[]): LiteratureSearchResult | null {
  let best: LiteratureSearchResult | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreCandidate(ref, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best || !isStrongTitleMatch(ref, best)) return null;
  return best;
}

export function hasReferenceLocator(ref: Pick<Reference, 'doi' | 'url'>): boolean {
  return Boolean(trimmed(ref.doi) || trimmed(ref.url));
}

export function hasExternalReferenceId(
  ref: Pick<Reference, 'semanticScholarId' | 'openAlexId'>,
): boolean {
  return Boolean(trimmed(ref.semanticScholarId) || trimmed(ref.openAlexId));
}

export function hasBibliographicFallbackIdentity(
  ref: Pick<Reference, 'title' | 'year' | 'authors'>,
): boolean {
  return Boolean(trimmed(ref.title)) && ref.year > 0 && hasAnyAuthor(ref.authors);
}

function applyCandidate(ref: Reference, candidate: LiteratureSearchResult): EnrichReferenceResult['updatedFields'] {
  const updated = new Set<EnrichReferenceResult['updatedFields'][number]>();

  const candidateDoi = trimmed(candidate.doi);
  if (!trimmed(ref.doi) && candidateDoi) {
    ref.doi = normalizeDoi(candidateDoi);
    updated.add('doi');
  }

  const candidateUrl = trimmed(candidate.url);
  if (!trimmed(ref.url) && candidateUrl) {
    ref.url = candidateUrl;
    updated.add('url');
  }

  const candidateAbstract = trimmed(candidate.abstract);
  if (!trimmed(ref.abstract) && candidateAbstract) {
    ref.abstract = candidateAbstract;
    updated.add('abstract');
  }

  const candidateS2 = trimmed(candidate.semanticScholarId);
  if (!trimmed(ref.semanticScholarId) && candidateS2) {
    ref.semanticScholarId = candidateS2;
    updated.add('semanticScholarId');
  }

  const candidateOpenAlex = trimmed(candidate.openAlexId);
  if (!trimmed(ref.openAlexId) && candidateOpenAlex) {
    ref.openAlexId = candidateOpenAlex;
    updated.add('openAlexId');
  }

  return FIELD_ORDER.filter((field) => updated.has(field));
}

export async function enrichReference(
  ref: Reference,
  deps: ReferenceEnrichmentDeps,
  options: EnrichReferenceOptions = {},
): Promise<EnrichReferenceResult> {
  const apis = options.apis && options.apis.length > 0 ? options.apis : DEFAULT_APIS;
  const limit = options.limit ?? 5;
  const allUpdated = new Set<EnrichReferenceResult['updatedFields'][number]>();
  let usedSource: string | undefined;
  const apiErrors: string[] = [];

  if (trimmed(ref.doi)) {
    try {
      const resolved = await deps.resolveDoi(ref.doi);
      if (resolved) {
        for (const field of applyCandidate(ref, resolved)) allUpdated.add(field);
        usedSource = resolved.source;
      }
    } catch (error) {
      apiErrors.push(`resolve-doi:${(error as Error).message}`);
    }
  }

  const shouldSearchByTitle = Boolean(trimmed(ref.title))
    && (!hasReferenceLocator(ref) || !hasExternalReferenceId(ref));

  if (shouldSearchByTitle) {
    const candidates: LiteratureSearchResult[] = [];
    for (const api of apis) {
      try {
        const results = await deps.searchByTitle({
          query: ref.title,
          api,
          limit,
        });
        candidates.push(...results);
      } catch (error) {
        apiErrors.push(`${api}:${(error as Error).message}`);
      }
    }

    const best = pickBestCandidate(ref, dedupeCandidates(candidates));
    if (best) {
      for (const field of applyCandidate(ref, best)) allUpdated.add(field);
      usedSource = usedSource ?? best.source;
    }
  }

  const updatedFields = FIELD_ORDER.filter((field) => allUpdated.has(field));
  if (updatedFields.length > 0) {
    return {
      refId: ref.id,
      title: ref.title,
      status: 'enriched',
      updatedFields,
      usedSource,
    };
  }

  const reason = apiErrors.length > 0 ? apiErrors.join('; ') : 'no-confident-match';
  return {
    refId: ref.id,
    title: ref.title,
    status: apiErrors.length > 0 ? 'failed' : 'unchanged',
    updatedFields: [],
    usedSource,
    reason,
  };
}

export async function enrichReferences(
  refs: Reference[],
  deps: ReferenceEnrichmentDeps,
  options: EnrichReferencesOptions = {},
): Promise<EnrichReferencesReport> {
  const onlyMissingLocator = options.onlyMissingLocator ?? false;
  const targets = onlyMissingLocator ? refs.filter((ref) => !hasReferenceLocator(ref)) : refs;

  const details: EnrichReferenceResult[] = [];
  for (const ref of targets) {
    details.push(await enrichReference(ref, deps, options));
  }

  return {
    scanned: refs.length,
    attempted: targets.length,
    enriched: details.filter((item) => item.status === 'enriched').length,
    unchanged: details.filter((item) => item.status === 'unchanged').length,
    failed: details.filter((item) => item.status === 'failed').length,
    details,
  };
}
