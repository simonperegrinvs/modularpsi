import type { GraphData, HypothesisCard, ReferenceClaim } from '../domain/types';

export interface NodeContradictionSummary {
  nodeId: string;
  nodeName: string;
  supportClaims: number;
  contradictClaims: number;
  nullClaims: number;
  status: 'mixed' | 'one-sided' | 'insufficient';
}

export interface HypothesisContradictionSummary {
  hypothesisId: string;
  status: 'mixed' | 'one-sided' | 'insufficient';
  supportRefs: number;
  contradictRefs: number;
  score: number;
}

function statusFromCounts(support: number, contradict: number): 'mixed' | 'one-sided' | 'insufficient' {
  if (support > 0 && contradict > 0) return 'mixed';
  if (support > 0 || contradict > 0) return 'one-sided';
  return 'insufficient';
}

function countDirections(claims: ReferenceClaim[]): { support: number; contradict: number; neutral: number } {
  let support = 0;
  let contradict = 0;
  let neutral = 0;
  for (const claim of claims) {
    if (claim.direction === 'supports') support++;
    else if (claim.direction === 'contradicts') contradict++;
    else neutral++;
  }
  return { support, contradict, neutral };
}

export function summarizeNodeContradictions(data: GraphData): NodeContradictionSummary[] {
  const refsById = new Map(data.references.map((r) => [r.id, r]));
  return data.nodes.map((node) => {
    const claims = node.referenceIds
      .map((id) => refsById.get(id))
      .filter(Boolean)
      .flatMap((r) => r?.claims ?? []);
    const counts = countDirections(claims);
    return {
      nodeId: node.id,
      nodeName: node.name,
      supportClaims: counts.support,
      contradictClaims: counts.contradict,
      nullClaims: counts.neutral,
      status: statusFromCounts(counts.support, counts.contradict),
    };
  });
}

export function summarizeHypothesisContradictions(hypotheses: HypothesisCard[]): HypothesisContradictionSummary[] {
  return hypotheses.map((h) => ({
    hypothesisId: h.id,
    status: statusFromCounts(h.supportRefIds.length, h.contradictRefIds.length),
    supportRefs: h.supportRefIds.length,
    contradictRefs: h.contradictRefIds.length,
    score: h.score,
  }));
}
