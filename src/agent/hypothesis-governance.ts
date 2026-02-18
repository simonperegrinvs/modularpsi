import type { GraphEdge, HypothesisCard, Reference } from '../domain/types';
import { isConstraintEdgeType } from '../domain/constraints';
import type { GovernanceConfig } from './governance';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(' ')
      .map((x) => x.trim())
      .filter((x) => x.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

export function validateHypothesesForGovernance(
  hypotheses: HypothesisCard[],
  references: Reference[],
  config: GovernanceConfig,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const refIds = new Set(references.map((r) => r.id));
  const byStatement = new Map<string, string[]>();

  for (const h of hypotheses) {
    if (!h.statement || h.statement.trim().length === 0) {
      errors.push(`Hypothesis ${h.id}: statement is empty`);
    }
    if (config.requireHypothesisEvidence && h.supportRefIds.length === 0) {
      errors.push(`Hypothesis ${h.id}: requires at least one supporting reference`);
    }
    for (const refId of h.supportRefIds) {
      if (!refIds.has(refId)) {
        errors.push(`Hypothesis ${h.id}: support ref not found (${refId})`);
      }
    }
    for (const refId of h.contradictRefIds) {
      if (!refIds.has(refId)) {
        warnings.push(`Hypothesis ${h.id}: contradict ref not found (${refId})`);
      }
    }

    const key = normalize(h.statement);
    const list = byStatement.get(key) ?? [];
    list.push(h.id);
    byStatement.set(key, list);
  }

  if (config.duplicateRejection) {
    for (const [statement, ids] of byStatement.entries()) {
      if (ids.length > 1) {
        errors.push(`Duplicate hypothesis statements (${ids.join(', ')}): "${statement}"`);
      }
    }

    for (let i = 0; i < hypotheses.length; i++) {
      for (let j = i + 1; j < hypotheses.length; j++) {
        const a = hypotheses[i];
        const b = hypotheses[j];
        const similarity = jaccard(tokenize(a.statement), tokenize(b.statement));
        const linkedOverlap = a.linkedNodeIds.some((id) => b.linkedNodeIds.includes(id));
        if (similarity >= config.fuzzyDuplicateThreshold && linkedOverlap) {
          errors.push(
            `Semantic duplicate hypotheses (${a.id}, ${b.id}) similarity=${similarity.toFixed(2)} with linked-node overlap`,
          );
        }
      }
    }
  }

  return { errors, warnings };
}

export function checkDailyHypothesisCap(
  hypotheses: HypothesisCard[],
  cap: number,
): { withinCap: boolean; todayCount: number; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = hypotheses.filter((h) => h.createdAt?.startsWith(today)).length;
  return {
    withinCap: todayCount < cap,
    todayCount,
    remaining: Math.max(0, cap - todayCount),
  };
}

export function checkDailyConstraintEdgeCap(
  edges: GraphEdge[],
  cap: number,
): { withinCap: boolean; todayCount: number; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = edges.filter(
    (e) => isConstraintEdgeType(e.type) && e.provenance?.timestamp?.startsWith(today),
  ).length;
  return {
    withinCap: todayCount < cap,
    todayCount,
    remaining: Math.max(0, cap - todayCount),
  };
}
