import { describe, it, expect } from 'vitest';
import type { GraphData } from '../../domain/types';
import { NODE_TYPE_REGULAR, EDGE_TYPE_IMPLICATION } from '../../domain/types';
import { rankHypotheses } from '../evidence';

function buildGraph(): GraphData {
  return {
    version: 1,
    prefix: 'P',
    rootId: 'P1',
    lastNodeNumber: 3,
    nodes: [
      { id: 'P1', name: 'Root', description: '', categoryId: 'general', keywords: [], type: NODE_TYPE_REGULAR, trust: 1, referenceIds: [] },
      { id: 'P2', name: 'Supported', description: '', categoryId: 'general', keywords: [], type: NODE_TYPE_REGULAR, trust: 0.8, referenceIds: ['ref-a'] },
      { id: 'P3', name: 'Challenged', description: '', categoryId: 'general', keywords: [], type: NODE_TYPE_REGULAR, trust: 0.8, referenceIds: ['ref-b'] },
    ],
    edges: [
      { id: 'P1-P2', sourceId: 'P1', targetId: 'P2', trust: 0.8, type: EDGE_TYPE_IMPLICATION, combinedTrust: 0.8 },
      { id: 'P1-P3', sourceId: 'P1', targetId: 'P3', trust: 0.8, type: EDGE_TYPE_IMPLICATION, combinedTrust: 0.8 },
    ],
    categories: [],
    references: [
      {
        id: 'ref-a',
        title: 'Positive Meta',
        authors: ['A'],
        year: 2024,
        publication: '',
        publisher: '',
        citation: '',
        pageStart: 0,
        pageEnd: 0,
        volume: 0,
        studyType: 'meta-analysis',
        effectDirection: 'supports',
        replicationStatus: 'multi-lab',
      },
      {
        id: 'ref-b',
        title: 'Failed Replication',
        authors: ['B'],
        year: 2025,
        publication: '',
        publisher: '',
        citation: '',
        pageStart: 0,
        pageEnd: 0,
        volume: 0,
        studyType: 'replication',
        effectDirection: 'challenges',
        replicationStatus: 'failed-replication',
      },
    ],
  };
}

describe('rankHypotheses', () => {
  it('ranks evidence-backed supporting nodes above challenged nodes with equal trust', () => {
    const graph = buildGraph();
    const ranked = rankHypotheses(graph);

    expect(ranked[0].id).toBe('P2');
    expect(ranked[1].id).toBe('P3');
    expect(ranked[0].rankScore).toBeGreaterThan(ranked[1].rankScore);
  });

  it('excludes unreferenced nodes by default', () => {
    const graph = buildGraph();
    graph.nodes.push({
      id: 'P4',
      name: 'No refs',
      description: '',
      categoryId: 'general',
      keywords: [],
      type: NODE_TYPE_REGULAR,
      trust: 1,
      referenceIds: [],
    });

    const ranked = rankHypotheses(graph);
    expect(ranked.some((n) => n.id === 'P4')).toBe(false);
  });
});

