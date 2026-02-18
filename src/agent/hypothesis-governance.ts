import type { GraphEdge, HypothesisCard, Reference } from '../domain/types';
import {
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_FAILS_WHEN,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_REQUIRES,
} from '../domain/types';
import type { GovernanceConfig } from './governance';

const CONSTRAINT_EDGE_TYPES = new Set<number>([
  EDGE_TYPE_REQUIRES,
  EDGE_TYPE_CONFOUNDED_BY,
  EDGE_TYPE_INCOMPATIBLE_WITH,
  EDGE_TYPE_FAILS_WHEN,
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
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
    (e) => CONSTRAINT_EDGE_TYPES.has(e.type) && e.provenance?.timestamp?.startsWith(today),
  ).length;
  return {
    withinCap: todayCount < cap,
    todayCount,
    remaining: Math.max(0, cap - todayCount),
  };
}
