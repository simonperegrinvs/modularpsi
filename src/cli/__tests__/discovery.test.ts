import { describe, it, expect } from 'vitest';
import { dedupeDiscoveredWorks, mapWorkToNode, normalizeDoi, parseOpenAlexAbstract } from '../discovery';

describe('discovery utilities', () => {
  it('normalizes doi urls', () => {
    expect(normalizeDoi('https://doi.org/10.1234/ABC')).toBe('10.1234/abc');
    expect(normalizeDoi('10.1234/Abc')).toBe('10.1234/abc');
  });

  it('builds openalex abstract text from inverted index', () => {
    const text = parseOpenAlexAbstract({ hello: [0], world: [1] });
    expect(text).toBe('hello world');
  });

  it('deduplicates by doi and merges source apis', () => {
    const deduped = dedupeDiscoveredWorks([
      {
        title: 'Paper A',
        authors: ['A'],
        year: 2024,
        doi: '10.1/abc',
        url: 'x',
        sourceApis: ['openalex'],
        externalIds: { openAlex: 'W1' },
      },
      {
        title: 'Paper A (extended title)',
        authors: ['A', 'B'],
        year: 2024,
        doi: 'https://doi.org/10.1/ABC',
        url: 'y',
        sourceApis: ['semanticscholar'],
        externalIds: { semanticScholar: 'S1' },
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].sourceApis).toContain('openalex');
    expect(deduped[0].sourceApis).toContain('semanticscholar');
  });

  it('maps discovered work to the best-matching node', () => {
    const result = mapWorkToNode(
      {
        title: 'Ganzfeld meta analysis and psi signal',
        authors: [],
        year: 2024,
        abstract: 'small positive effect in ganzfeld studies',
        sourceApis: ['openalex'],
        externalIds: {},
      },
      [
        { id: 'P48', name: 'Ganzfeld signal', description: 'meta-analysis of ganzfeld effects', categoryId: 'general', keywords: ['ganzfeld'], type: 0, trust: 0.4, referenceIds: [] },
        { id: 'P53', name: 'Publication bias', description: 'selective reporting', categoryId: 'general', keywords: ['bias'], type: 0, trust: 0.8, referenceIds: [] },
      ],
    );

    expect(result.nodeId).toBe('P48');
    expect(result.confidence).toBeGreaterThan(0);
  });
});

