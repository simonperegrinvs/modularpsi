import type { GraphData, HypothesisCard, Reference } from '../domain/types';
import { createHypothesis } from '../domain/hypothesis';
import { computeHypothesisScore } from './hypothesis-scoring';

export interface HypothesisLoopResult {
  accepted: HypothesisCard[];
  rejected: Array<{ nodeId: string; reason: string }>;
}

function refsForNode(data: GraphData, nodeId: string): Reference[] {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const set = new Set(node.referenceIds);
  return data.references.filter((r) => set.has(r.id));
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function alreadyRepresented(existing: HypothesisCard[], statement: string, linkedNodeId: string): boolean {
  const norm = statement.toLowerCase().trim();
  return existing.some((h) =>
    h.statement.toLowerCase().trim() === norm ||
    (h.linkedNodeIds.includes(linkedNodeId) && h.statement.toLowerCase().includes(linkedNodeId.toLowerCase())),
  );
}

function generatorStatement(nodeName: string, mixed: boolean): string {
  if (mixed) {
    return `${nodeName} appears condition-dependent: contradictory findings may reflect boundary conditions or confounders.`;
  }
  return `${nodeName} appears supported across current evidence and merits focused constraint testing.`;
}

export function runHypothesisLoop(
  data: GraphData,
  options?: { top?: number; runId?: string; nowIso?: string },
): HypothesisLoopResult {
  const top = options?.top ?? 5;
  const now = options?.nowIso ?? new Date().toISOString();
  const runId = options?.runId;

  const accepted: HypothesisCard[] = [];
  const rejected: Array<{ nodeId: string; reason: string }> = [];

  const candidateNodes = data.nodes
    .filter((n) => n.id !== data.rootId)
    .slice(0, 200);

  for (const node of candidateNodes) {
    if (accepted.length >= top) break;
    const refs = refsForNode(data, node.id);
    const refsWithClaims = refs.filter((r) => (r.claims?.length ?? 0) > 0);
    if (refsWithClaims.length === 0) continue;

    // Generator
    const supportRefs = uniqueById(refsWithClaims.filter((r) => (r.claims ?? []).some((c) => c.direction === 'supports')));
    const contradictRefs = uniqueById(refsWithClaims.filter((r) => (r.claims ?? []).some((c) => c.direction === 'contradicts')));
    const mixed = supportRefs.length > 0 && contradictRefs.length > 0;
    const statement = generatorStatement(node.name, mixed);

    if (alreadyRepresented(data.hypotheses, statement, node.id)) {
      rejected.push({ nodeId: node.id, reason: 'duplicate-hypothesis' });
      continue;
    }

    // Skeptic
    if (supportRefs.length < 1) {
      rejected.push({ nodeId: node.id, reason: 'insufficient-support' });
      continue;
    }
    if (contradictRefs.length > supportRefs.length + 1) {
      rejected.push({ nodeId: node.id, reason: 'contradiction-dominant' });
      continue;
    }

    // Judge
    const proposed = createHypothesis(data.hypotheses.concat(accepted), {
      statement,
      linkedNodeIds: [node.id],
      supportRefIds: supportRefs.map((r) => r.id),
      contradictRefIds: contradictRefs.map((r) => r.id),
      constraintEdgeIds: [],
      status: 'draft',
      createdByRunId: runId,
      nowIso: now,
    });
    proposed.score = computeHypothesisScore(proposed).score;
    accepted.push(proposed);
  }

  return { accepted, rejected };
}
