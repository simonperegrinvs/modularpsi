import { describe, expect, it } from 'vitest';
import type { GraphNode, Reference } from '../../domain/types';
import {
  validateNodeForPublish,
  validateReferenceForPublish,
  type PublishGateConfig,
} from '../publish-validation';

const config: PublishGateConfig = {
  requireDescription: true,
  requireRefTitleYearDoi: true,
  duplicateRejection: true,
  fuzzyDuplicateThreshold: 0.85,
  maxDailyNewNodes: 20,
  maxDailyTrustDelta: 2,
};

function baseNode(overrides: Partial<GraphNode>): GraphNode {
  return {
    id: 'P1',
    name: 'Root',
    description: 'desc',
    categoryId: 'general',
    keywords: [],
    type: 0,
    trust: 1,
    referenceIds: [],
    ...overrides,
  };
}

function baseRef(overrides: Partial<Reference>): Reference {
  return {
    id: 'ref-1',
    title: 'Ref',
    authors: ['A'],
    year: 2020,
    publication: '',
    publisher: '',
    citation: '',
    pageStart: 0,
    pageEnd: 0,
    volume: 0,
    description: 'desc',
    doi: '10.1000/test',
    url: '',
    semanticScholarId: '',
    openAlexId: '',
    abstract: '',
    ...overrides,
  };
}

describe('publish validation self-duplicate handling', () => {
  it('does not warn for a node matching itself by id/name', () => {
    const node = baseNode({ id: 'P2', name: 'Ganzfeld' });
    const result = validateNodeForPublish(
      { id: 'P2', name: 'Ganzfeld', description: 'desc' },
      [node],
      config,
    );
    expect(result.warnings).toHaveLength(0);
  });

  it('still warns for duplicate node names on different ids', () => {
    const result = validateNodeForPublish(
      { id: 'P2', name: 'Ganzfeld', description: 'desc' },
      [baseNode({ id: 'P3', name: 'Ganzfeld' })],
      config,
    );
    expect(result.warnings.some((w) => w.includes('Duplicate node name'))).toBe(true);
  });

  it('does not error for a reference matching itself by id', () => {
    const ref = baseRef({ id: 'ref-2', title: 'Ganzfeld Meta-Analysis', doi: '10.1000/xyz' });
    const result = validateReferenceForPublish(
      { id: 'ref-2', title: 'Ganzfeld Meta-Analysis', authors: ['A'], year: 2020, doi: '10.1000/xyz', url: '' },
      [ref],
      config,
    );
    expect(result.errors).toHaveLength(0);
  });

  it('still errors for a true duplicate on a different reference id', () => {
    const result = validateReferenceForPublish(
      { id: 'ref-2', title: 'Ganzfeld Meta-Analysis', authors: ['A'], year: 2020, doi: '10.1000/xyz', url: '' },
      [baseRef({ id: 'ref-9', title: 'Different title', doi: '10.1000/xyz' })],
      config,
    );
    expect(result.errors.some((e) => e.includes('Duplicate reference detected'))).toBe(true);
  });
});
