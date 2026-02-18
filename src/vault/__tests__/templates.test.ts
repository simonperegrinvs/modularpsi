import { describe, expect, it } from 'vitest';
import { createEmptyGraph } from '../../io/json-io';
import { generateNodeNote, generateRefNote } from '../templates';

describe('vault templates', () => {
  it('includes hypothesis and contradiction summary sections in node note', () => {
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld',
      description: 'Node description',
      categoryId: 'general',
      keywords: [],
      type: 0,
      trust: 0.7,
      referenceIds: ['ref-1'],
    });
    data.references.push({
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
      description: '',
      doi: '',
      url: '',
      semanticScholarId: '',
      openAlexId: '',
      abstract: '',
      claims: [
        {
          claimId: 'c1',
          text: 'Supports',
          direction: 'supports',
          contextTags: [],
          confidence: 0.8,
          rationale: '',
          extractorModel: 'test',
          createdAt: '2026-02-18T00:00:00.000Z',
        },
        {
          claimId: 'c2',
          text: 'Contradicts',
          direction: 'contradicts',
          contextTags: [],
          confidence: 0.8,
          rationale: '',
          extractorModel: 'test',
          createdAt: '2026-02-18T00:00:00.000Z',
        },
      ],
    });
    data.hypotheses.push({
      id: 'hyp-1',
      statement: 'Hypothesis',
      linkedNodeIds: ['P2'],
      supportRefIds: ['ref-1'],
      contradictRefIds: [],
      constraintEdgeIds: [],
      score: 0.8,
      status: 'draft',
      createdAt: '2026-02-18T00:00:00.000Z',
    });

    const note = generateNodeNote(data.nodes[1], data);
    expect(note).toContain('## Hypotheses');
    expect(note).toContain('## Contradiction Summary');
    expect(note).toContain('status: mixed');
  });

  it('includes hypothesis support/contradiction links in reference note', () => {
    const data = createEmptyGraph();
    data.references.push({
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
      description: '',
      doi: '',
      url: '',
      semanticScholarId: '',
      openAlexId: '',
      abstract: '',
    });
    data.hypotheses.push({
      id: 'hyp-1',
      statement: 'H1',
      linkedNodeIds: [],
      supportRefIds: ['ref-1'],
      contradictRefIds: [],
      constraintEdgeIds: [],
      score: 0.4,
      status: 'draft',
      createdAt: '2026-02-18T00:00:00.000Z',
    });
    data.hypotheses.push({
      id: 'hyp-2',
      statement: 'H2',
      linkedNodeIds: [],
      supportRefIds: [],
      contradictRefIds: ['ref-1'],
      constraintEdgeIds: [],
      score: 0.4,
      status: 'draft',
      createdAt: '2026-02-18T00:00:00.000Z',
    });

    const note = generateRefNote(data.references[0], data);
    expect(note).toContain('## Hypothesis Links');
    expect(note).toContain('Supports hyp-1');
    expect(note).toContain('Contradicts hyp-2');
  });
});
