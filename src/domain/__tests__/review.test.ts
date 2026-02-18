import { describe, expect, it } from 'vitest';
import { applyReviewStatusToNode, applyReviewStatusToReference } from '../review';
import type { GraphNode, Reference } from '../types';

function fakeNode(): GraphNode {
  return {
    id: 'P2',
    name: 'Node',
    description: '',
    categoryId: 'general',
    keywords: [],
    type: 0,
    trust: 0.5,
    referenceIds: [],
  };
}

function fakeReference(): Reference {
  return {
    id: 'ref-1',
    title: 'Ref',
    authors: [],
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
  };
}

describe('review lifecycle helpers', () => {
  it('updates node review status and reviewed timestamp on terminal states', () => {
    const node = fakeNode();
    applyReviewStatusToNode(node, 'approved', '2026-02-18T10:00:00.000Z');
    expect(node.reviewStatus).toBe('approved');
    expect(node.lastReviewedAt).toBe('2026-02-18T10:00:00.000Z');
  });

  it('keeps reference processingStatus aligned with review status', () => {
    const ref = fakeReference();
    applyReviewStatusToReference(ref, 'draft');
    expect(ref.processingStatus).toBe('imported-draft');

    applyReviewStatusToReference(ref, 'approved');
    expect(ref.processingStatus).toBe('approved');

    applyReviewStatusToReference(ref, 'rejected');
    expect(ref.processingStatus).toBe('rejected');
  });
});
