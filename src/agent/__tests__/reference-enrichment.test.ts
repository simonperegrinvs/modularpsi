import { describe, expect, it } from 'vitest';
import type { Reference } from '../../domain/types';
import type { LiteratureSearchResult } from '../search';
import {
  enrichReference,
  enrichReferences,
  hasBibliographicFallbackIdentity,
  hasExternalReferenceId,
  hasReferenceLocator,
} from '../reference-enrichment';

function buildRef(overrides: Partial<Reference> = {}): Reference {
  return {
    id: 'ref-1',
    title: 'Meta-analysis of free-response studies, 1992-2008',
    authors: ['Jessica Utts'],
    year: 2011,
    publication: '',
    publisher: '',
    citation: '',
    pageStart: 0,
    pageEnd: 0,
    volume: 0,
    description: '',
    doi: '',
    url: '',
    semanticScholarId: '',
    openAlexId: '',
    abstract: '',
    ...overrides,
  };
}

describe('reference enrichment', () => {
  it('fills missing identity fields from a strong title/year/author match', async () => {
    const ref = buildRef();
    const result = await enrichReference(
      ref,
      {
        resolveDoi: async () => null,
        searchByTitle: async () => {
          const candidates: LiteratureSearchResult[] = [
            {
              title: 'Different Paper',
              authors: ['X'],
              year: 2011,
              source: 'semantic-scholar',
            },
            {
              title: 'Meta-analysis of free-response studies, 1992-2008',
              authors: ['Jessica Utts'],
              year: 2011,
              doi: 'https://doi.org/10.1016/j.explore.2010.11.001',
              url: 'https://doi.org/10.1016/j.explore.2010.11.001',
              semanticScholarId: 'S2-123',
              openAlexId: 'https://openalex.org/W123',
              source: 'openalex',
            },
          ];
          return candidates;
        },
      },
      { apis: ['semantic-scholar'], limit: 5 },
    );

    expect(result.status).toBe('enriched');
    expect(result.updatedFields).toEqual(['doi', 'url', 'semanticScholarId', 'openAlexId']);
    expect(ref.doi).toBe('10.1016/j.explore.2010.11.001');
    expect(ref.semanticScholarId).toBe('S2-123');
    expect(ref.openAlexId).toBe('https://openalex.org/W123');
  });

  it('returns unchanged when no confident match exists', async () => {
    const ref = buildRef({ title: 'Unique Title Here', authors: ['A'], year: 2000 });
    const result = await enrichReference(
      ref,
      {
        resolveDoi: async () => null,
        searchByTitle: async () => [
          {
            title: 'Totally Unrelated Result',
            authors: ['B'],
            year: 2018,
            source: 'semantic-scholar',
          },
        ],
      },
      { apis: ['semantic-scholar'], limit: 3 },
    );

    expect(result.status).toBe('unchanged');
    expect(result.updatedFields).toHaveLength(0);
    expect(ref.doi).toBe('');
    expect(ref.url).toBe('');
  });

  it('processes only references missing DOI/URL when onlyMissingLocator=true', async () => {
    const refs = [
      buildRef({ id: 'ref-missing' }),
      buildRef({ id: 'ref-complete', doi: '10.1000/x', url: 'https://doi.org/10.1000/x' }),
    ];
    let calls = 0;
    const report = await enrichReferences(
      refs,
      {
        resolveDoi: async () => null,
        searchByTitle: async () => {
          calls++;
          return [{
            title: refs[0].title,
            authors: refs[0].authors,
            year: refs[0].year,
            doi: '10.1000/new',
            source: 'semantic-scholar',
          }];
        },
      },
      { onlyMissingLocator: true },
    );

    expect(report.scanned).toBe(2);
    expect(report.attempted).toBe(1);
    expect(calls).toBe(2); // one call per default API (semantic-scholar + openalex)
    expect(refs[0].doi).toBe('10.1000/new');
    expect(refs[1].doi).toBe('10.1000/x');
  });

  it('exposes identity helper checks used by governance fallback', () => {
    const ref = buildRef({
      semanticScholarId: 'S2-1',
      authors: ['A'],
      year: 2019,
      title: 'T',
    });
    expect(hasReferenceLocator(ref)).toBe(false);
    expect(hasExternalReferenceId(ref)).toBe(true);
    expect(hasBibliographicFallbackIdentity(ref)).toBe(true);
  });
});
