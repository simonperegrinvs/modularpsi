import type { HypothesisCard, HypothesisStatus } from './types';

function parseHypothesisNumber(id: string): number {
  const match = /^hyp-(\d+)$/.exec(id);
  return match ? parseInt(match[1], 10) : 0;
}

export function nextHypothesisId(existing: HypothesisCard[]): string {
  const next = existing.reduce((max, h) => Math.max(max, parseHypothesisNumber(h.id)), 0) + 1;
  return `hyp-${next}`;
}

export interface CreateHypothesisInput {
  statement: string;
  linkedNodeIds?: string[];
  supportRefIds?: string[];
  contradictRefIds?: string[];
  constraintEdgeIds?: string[];
  score?: number;
  status?: HypothesisStatus;
  createdByRunId?: string;
  nowIso?: string;
}

export function createHypothesis(
  existing: HypothesisCard[],
  input: CreateHypothesisInput,
): HypothesisCard {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    id: nextHypothesisId(existing),
    statement: input.statement.trim(),
    linkedNodeIds: [...new Set(input.linkedNodeIds ?? [])],
    supportRefIds: [...new Set(input.supportRefIds ?? [])],
    contradictRefIds: [...new Set(input.contradictRefIds ?? [])],
    constraintEdgeIds: [...new Set(input.constraintEdgeIds ?? [])],
    score: input.score ?? 0,
    status: input.status ?? 'draft',
    createdAt: now,
    createdByRunId: input.createdByRunId,
  };
}
