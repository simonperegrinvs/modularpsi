import type { Reference } from '../../domain/types';
import type { LiteratureSearchResult } from './types';

/** Normalize a string for fuzzy comparison */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Check if a search result duplicates an existing reference */
export function isDuplicate(
  result: LiteratureSearchResult,
  existingRefs: Reference[],
): { duplicate: boolean; matchedRefId?: string; matchType?: string } {
  // 1. Exact DOI match
  if (result.doi) {
    const doiNorm = result.doi.toLowerCase();
    const match = existingRefs.find((r) => r.doi && r.doi.toLowerCase() === doiNorm);
    if (match) return { duplicate: true, matchedRefId: match.id, matchType: 'exact-doi' };
  }

  // 2. Exact Semantic Scholar ID match
  if (result.semanticScholarId) {
    const match = existingRefs.find((r) => r.semanticScholarId === result.semanticScholarId);
    if (match) return { duplicate: true, matchedRefId: match.id, matchType: 'exact-s2id' };
  }

  // 3. Exact OpenAlex ID match
  if (result.openAlexId) {
    const match = existingRefs.find((r) => r.openAlexId === result.openAlexId);
    if (match) return { duplicate: true, matchedRefId: match.id, matchType: 'exact-openalexid' };
  }

  // 4. Fuzzy title + year match
  const titleNorm = normalize(result.title);
  if (titleNorm.length > 10) {
    const match = existingRefs.find((r) => {
      const refTitleNorm = normalize(r.title);
      // Same year (within 1 year tolerance) and similar title
      const yearMatch = Math.abs(r.year - result.year) <= 1;
      const titleMatch = refTitleNorm === titleNorm ||
        (refTitleNorm.length > 10 && (
          refTitleNorm.includes(titleNorm) || titleNorm.includes(refTitleNorm)
        ));
      return yearMatch && titleMatch;
    });
    if (match) return { duplicate: true, matchedRefId: match.id, matchType: 'fuzzy-title-year' };
  }

  return { duplicate: false };
}
