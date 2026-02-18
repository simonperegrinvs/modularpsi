import type { GraphNode, Reference } from './types';
import type { AuditEntry } from '../agent/audit';
import { isDuplicate } from '../agent/search/dedup';

export interface PublishGateConfig {
  requireDescription: boolean;
  requireRefTitleYearDoi: boolean;
  duplicateRejection: boolean;
  fuzzyDuplicateThreshold: number;
  maxDailyNewNodes: number;
  maxDailyTrustDelta: number;
}

export interface PublishGateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Node Validation ─────────────────────────────────────────

export function validateNodeForPublish(
  node: Partial<GraphNode> & { name: string },
  existingNodes: GraphNode[],
  config: PublishGateConfig,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!node.name || node.name.trim().length === 0) {
    errors.push('Node name is empty');
  }

  if (config.requireDescription && (!node.description || node.description.trim().length === 0)) {
    errors.push('Node description is required but empty');
  }

  // Check for duplicate names
  if (config.duplicateRejection && node.name) {
    const nameLower = node.name.toLowerCase().trim();
    const dupes = existingNodes.filter(
      (n) => n.name.toLowerCase().trim() === nameLower,
    );
    if (dupes.length > 0) {
      warnings.push(
        `Duplicate node name "${node.name}" matches: ${dupes.map((d) => d.id).join(', ')}`,
      );
    }
  }

  return { errors, warnings };
}

// ── Reference Validation ────────────────────────────────────

export function validateReferenceForPublish(
  ref: Partial<Reference> & { title: string },
  existingRefs: Reference[],
  config: PublishGateConfig,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ref.title || ref.title.trim().length === 0) {
    errors.push('Reference title is empty');
  }

  if (config.requireRefTitleYearDoi) {
    if (!ref.year || ref.year === 0) {
      errors.push('Reference year is required');
    }
    if ((!ref.doi || ref.doi.trim().length === 0) && (!ref.url || ref.url.trim().length === 0)) {
      errors.push('Reference requires either DOI or URL');
    }
  }

  // Check for duplicates using existing dedup logic
  if (config.duplicateRejection) {
    const dupCheck = isDuplicate(
      {
        title: ref.title,
        authors: ref.authors ?? [],
        year: ref.year ?? 0,
        doi: ref.doi,
        semanticScholarId: ref.semanticScholarId,
        openAlexId: ref.openAlexId,
        source: 'semantic-scholar',
      },
      existingRefs,
    );
    if (dupCheck.duplicate) {
      errors.push(
        `Duplicate reference detected (${dupCheck.matchType}): matches ${dupCheck.matchedRefId}`,
      );
    }
  }

  return { errors, warnings };
}

// ── Daily Node Cap ──────────────────────────────────────────

export function checkDailyNodeCap(
  existingNodes: GraphNode[],
  cap: number,
): { withinCap: boolean; todayCount: number; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = existingNodes.filter(
    (n) => n.provenance?.timestamp?.startsWith(today),
  ).length;
  return {
    withinCap: todayCount < cap,
    todayCount,
    remaining: Math.max(0, cap - todayCount),
  };
}

// ── Daily Trust Delta ───────────────────────────────────────

export function checkDailyTrustDelta(
  nodeId: string,
  auditEntries: AuditEntry[],
  maxDelta: number,
): { withinLimit: boolean; totalDelta: number } {
  let totalDelta = 0;
  for (const entry of auditEntries) {
    if (entry.entityId !== nodeId) continue;
    if (entry.action !== 'update-trust' && entry.action !== 'trust-propagation') continue;
    const before = (entry.before as { trust?: number })?.trust ?? 0;
    const after = (entry.after as { trust?: number })?.trust ?? 0;
    totalDelta += Math.abs(after - before);
  }
  return {
    withinLimit: totalDelta <= maxDelta,
    totalDelta,
  };
}

// ── Full Publish Gate ───────────────────────────────────────

export interface PublishCandidate {
  nodes?: Array<Partial<GraphNode> & { name: string }>;
  references?: Array<Partial<Reference> & { title: string }>;
}

export interface ExistingData {
  nodes: GraphNode[];
  references: Reference[];
  auditEntries: AuditEntry[];
}

export function runPublishGate(
  candidate: PublishCandidate,
  existingData: ExistingData,
  config: PublishGateConfig,
): PublishGateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check daily node cap
  if (candidate.nodes && candidate.nodes.length > 0) {
    const capCheck = checkDailyNodeCap(existingData.nodes, config.maxDailyNewNodes);
    if (!capCheck.withinCap) {
      errors.push(
        `Daily node cap exceeded: ${capCheck.todayCount}/${config.maxDailyNewNodes} nodes created today`,
      );
    } else if (capCheck.remaining < candidate.nodes.length) {
      warnings.push(
        `Only ${capCheck.remaining} nodes remaining in daily cap (${candidate.nodes.length} requested)`,
      );
    }
  }

  // Validate each node
  for (const node of candidate.nodes ?? []) {
    const result = validateNodeForPublish(node, existingData.nodes, config);
    errors.push(...result.errors.map((e) => `Node "${node.name}": ${e}`));
    warnings.push(...result.warnings.map((w) => `Node "${node.name}": ${w}`));
  }

  // Validate each reference
  for (const ref of candidate.references ?? []) {
    const result = validateReferenceForPublish(ref, existingData.references, config);
    errors.push(...result.errors.map((e) => `Ref "${ref.title}": ${e}`));
    warnings.push(...result.warnings.map((w) => `Ref "${ref.title}": ${w}`));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
