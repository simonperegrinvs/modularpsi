import type { HypothesisCard } from '../domain/types';

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export interface HypothesisScoreBreakdown {
  supportSignal: number;
  contradictionPenalty: number;
  constraintSignal: number;
  linkageSignal: number;
  score: number;
}

export function computeHypothesisScore(h: HypothesisCard): HypothesisScoreBreakdown {
  const supportSignal = clamp(h.supportRefIds.length / 5);
  const contradictionPenalty = clamp(h.contradictRefIds.length / 4);
  const constraintSignal = clamp(h.constraintEdgeIds.length / 3);
  const linkageSignal = clamp(h.linkedNodeIds.length / 4);

  const raw =
    0.55 * supportSignal +
    0.2 * constraintSignal +
    0.15 * linkageSignal -
    0.35 * contradictionPenalty;

  return {
    supportSignal,
    contradictionPenalty,
    constraintSignal,
    linkageSignal,
    score: clamp(raw),
  };
}

export interface TriageOptions {
  top: number;
  minScore: number;
  promote: boolean;
  nowIso?: string;
}

export function triageHypotheses(
  hypotheses: HypothesisCard[],
  options: TriageOptions,
): {
  updatedHypotheses: HypothesisCard[];
  selected: HypothesisCard[];
  promoted: number;
  scoreBreakdowns: Record<string, HypothesisScoreBreakdown>;
} {
  const now = options.nowIso ?? new Date().toISOString();
  const scoreBreakdowns: Record<string, HypothesisScoreBreakdown> = {};
  const rescored = hypotheses.map((h) => {
    const breakdown = computeHypothesisScore(h);
    scoreBreakdowns[h.id] = breakdown;
    const score = breakdown.score;
    return {
      ...h,
      score,
      updatedAt: now,
    };
  });

  const selected = [...rescored]
    .filter((h) => h.score >= options.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, options.top));

  let promoted = 0;
  let updatedHypotheses = rescored;
  if (options.promote) {
    const selectedSet = new Set(selected.map((h) => h.id));
    updatedHypotheses = rescored.map((h) => {
      if (!selectedSet.has(h.id)) return h;
      if (h.status === 'draft') {
        promoted++;
        return { ...h, status: 'pending-review', updatedAt: now };
      }
      return h;
    });
  }

  return { updatedHypotheses, selected, promoted, scoreBreakdowns };
}
