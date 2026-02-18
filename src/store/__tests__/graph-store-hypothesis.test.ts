import { describe, expect, it } from 'vitest';
import { useGraphStore } from '../graph-store';
import { createEmptyGraph } from '../../io/json-io';

describe('graph store hypothesis actions', () => {
  it('updates hypothesis status through store action', () => {
    const data = createEmptyGraph();
    data.hypotheses.push({
      id: 'hyp-1',
      statement: 'Test hypothesis',
      linkedNodeIds: ['P1'],
      supportRefIds: [],
      contradictRefIds: [],
      constraintEdgeIds: [],
      score: 0.5,
      status: 'draft',
      createdAt: '2026-02-18T10:00:00.000Z',
    });

    useGraphStore.setState({
      nodes: data.nodes,
      edges: data.edges,
      categories: data.categories,
      references: data.references,
      hypotheses: data.hypotheses,
      prefix: data.prefix,
      rootId: data.rootId,
      lastNodeNumber: data.lastNodeNumber,
    });
    useGraphStore.getState().updateHypothesis('hyp-1', { status: 'approved' });

    const updated = useGraphStore.getState().hypotheses.find((h) => h.id === 'hyp-1');
    expect(updated?.status).toBe('approved');
    expect(updated?.updatedAt).toBeTruthy();
  });

  it('includes hypotheses in serialized graph snapshot', () => {
    const data = createEmptyGraph();
    data.hypotheses.push({
      id: 'hyp-1',
      statement: 'Snapshot hypothesis',
      linkedNodeIds: [],
      supportRefIds: [],
      contradictRefIds: [],
      constraintEdgeIds: [],
      score: 0.2,
      status: 'draft',
      createdAt: '2026-02-18T10:00:00.000Z',
    });
    useGraphStore.setState({
      nodes: data.nodes,
      edges: data.edges,
      categories: data.categories,
      references: data.references,
      hypotheses: data.hypotheses,
      prefix: data.prefix,
      rootId: data.rootId,
      lastNodeNumber: data.lastNodeNumber,
    });

    const graph = useGraphStore.getState().getGraphData();
    expect(graph.hypotheses).toHaveLength(1);
    expect(graph.hypotheses[0].id).toBe('hyp-1');
  });
});
