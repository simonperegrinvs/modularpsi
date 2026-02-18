import { describe, it, expect } from 'vitest';
import { createEmptyGraph, graphToJson, jsonToGraph } from '../json-io';

describe('createEmptyGraph', () => {
  it('creates a valid graph with root node', () => {
    const g = createEmptyGraph();
    expect(g.version).toBe(1);
    expect(g.prefix).toBe('P');
    expect(g.rootId).toBe('P1');
    expect(g.lastNodeNumber).toBe(1);
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0].id).toBe('P1');
    expect(g.nodes[0].name).toBe('Root');
    expect(g.nodes[0].trust).toBe(1.0);
    expect(g.edges).toHaveLength(0);
    expect(g.categories.length).toBeGreaterThan(0);
    expect(g.references).toHaveLength(0);
    expect(g.metadata?.schemaVersion).toBe(1);
  });

  it('supports M prefix', () => {
    const g = createEmptyGraph('M');
    expect(g.prefix).toBe('M');
    expect(g.rootId).toBe('M1');
    expect(g.nodes[0].id).toBe('M1');
  });
});

describe('round-trip: graphToJson → jsonToGraph', () => {
  it('preserves data through serialization', () => {
    const original = createEmptyGraph();
    const json = graphToJson(original);
    const restored = jsonToGraph(json);

    expect(restored.version).toBe(original.version);
    expect(restored.prefix).toBe(original.prefix);
    expect(restored.rootId).toBe(original.rootId);
    expect(restored.nodes).toEqual(original.nodes);
    expect(restored.edges).toEqual(original.edges);
    expect(restored.categories).toEqual(original.categories);
  });
});

describe('jsonToGraph backfills', () => {
  it('backfills missing node fields', () => {
    const json = JSON.stringify({
      version: 1,
      prefix: 'P',
      rootId: 'P1',
      lastNodeNumber: 1,
      nodes: [{ id: 'P1', name: 'Root', description: '', categoryId: 'general' }],
      edges: [],
      categories: [],
    });
    const g = jsonToGraph(json);
    expect(g.nodes[0].keywords).toEqual([]);
    expect(g.nodes[0].referenceIds).toEqual([]);
    expect(g.nodes[0].trust).toBe(-1);
    expect(g.nodes[0].type).toBe(0);
  });

  it('backfills missing edge fields', () => {
    const json = JSON.stringify({
      version: 1,
      prefix: 'P',
      rootId: 'P1',
      lastNodeNumber: 2,
      nodes: [
        { id: 'P1', name: 'Root', description: '', categoryId: 'general' },
        { id: 'P2', name: 'Child', description: '', categoryId: 'general' },
      ],
      edges: [{ id: 'e1', sourceId: 'P1', targetId: 'P2', trust: 0.5 }],
      categories: [],
    });
    const g = jsonToGraph(json);
    expect(g.edges[0].combinedTrust).toBe(-1);
    expect(g.edges[0].type).toBe(0);
  });

  it('backfills missing categories with defaults', () => {
    const json = JSON.stringify({
      version: 1,
      prefix: 'P',
      rootId: 'P1',
      lastNodeNumber: 1,
      nodes: [],
      edges: [],
    });
    const g = jsonToGraph(json);
    expect(g.categories.length).toBeGreaterThan(0);
    expect(g.references).toEqual([]);
  });

  it('backfills missing metadata.schemaVersion for legacy graphs', () => {
    const json = JSON.stringify({
      version: 1,
      prefix: 'P',
      rootId: 'P1',
      lastNodeNumber: 1,
      nodes: [],
      edges: [],
      categories: [],
      references: [],
    });
    const g = jsonToGraph(json);
    expect(g.metadata?.schemaVersion).toBe(1);
  });

  it('preserves trust=0 (does not backfill falsy values)', () => {
    const json = JSON.stringify({
      version: 1,
      prefix: 'P',
      rootId: 'P1',
      lastNodeNumber: 1,
      nodes: [{ id: 'P1', name: 'Root', description: '', categoryId: 'general', trust: 0, type: 0 }],
      edges: [],
      categories: [],
    });
    const g = jsonToGraph(json);
    expect(g.nodes[0].trust).toBe(0);
  });

  it('maps reviewStatus to reference processingStatus when missing', () => {
    const json = JSON.stringify({
      version: 1,
      prefix: 'P',
      rootId: 'P1',
      lastNodeNumber: 1,
      nodes: [],
      edges: [],
      categories: [],
      references: [
        {
          id: 'ref-1',
          title: 'A',
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
          reviewStatus: 'draft',
        },
      ],
    });
    const g = jsonToGraph(json);
    expect(g.references[0].processingStatus).toBe('imported-draft');
    expect(g.references[0].claims).toEqual([]);
  });
});
