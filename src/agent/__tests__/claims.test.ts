import { describe, expect, it } from 'vitest';
import type { Reference } from '../../domain/types';
import { extractClaimsForReference, extractClaimsFromAbstract } from '../claims';

function fakeReference(overrides: Partial<Reference>): Reference {
  return {
    id: 'ref-1',
    title: 'Test Ref',
    authors: ['A. Author'],
    year: 2024,
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

describe('claim extraction', () => {
  it('extracts directional claims from abstract sentences', () => {
    const abstract = [
      'This registered study found a significant effect for the ganzfeld task in participants across two labs.',
      'A separate control analysis did not find significant support when leakage confounders were present.',
    ].join(' ');

    const claims = extractClaimsFromAbstract(abstract, '2026-02-18T10:00:00.000Z');
    expect(claims.length).toBe(2);
    expect(claims[0].direction).toBe('supports');
    expect(claims[1].direction).toBe('contradicts');
    expect(claims[0].contextTags).toContain('phenomenon');
    expect(claims[1].contextTags).toContain('confounder');
  });

  it('skips extraction when abstract checksum is unchanged and claims already exist', () => {
    const ref = fakeReference({
      abstract: 'This study found a significant effect in participants with a clear protocol description.',
    });
    const first = extractClaimsForReference(ref, { nowIso: '2026-02-18T10:00:00.000Z' });
    expect(first.updated).toBe(true);
    expect((ref.claims ?? []).length).toBeGreaterThan(0);

    const second = extractClaimsForReference(ref, { nowIso: '2026-02-18T11:00:00.000Z' });
    expect(second.updated).toBe(false);
    expect(second.reason).toBe('abstract-unchanged');
  });

  it('re-extracts when force=true and handles missing abstracts', () => {
    const withAbstract = fakeReference({
      abstract: 'The experiment found a significant hit rate increase in the target condition.',
    });
    const initial = extractClaimsForReference(withAbstract, { nowIso: '2026-02-18T10:00:00.000Z' });
    expect(initial.updated).toBe(true);
    const previousClaimId = withAbstract.claims?.[0]?.claimId;

    const forced = extractClaimsForReference(withAbstract, { force: true, nowIso: '2026-02-18T12:00:00.000Z' });
    expect(forced.updated).toBe(true);
    expect(forced.reason).toBe('forced-reextract');
    expect(withAbstract.claims?.[0]?.claimId).toBe(previousClaimId);

    const noAbstract = fakeReference({ abstract: '' });
    const none = extractClaimsForReference(noAbstract);
    expect(none.updated).toBe(false);
    expect(none.reason).toBe('no-abstract');
  });
});
