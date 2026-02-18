import type { GraphData, GraphNode, Reference } from '../domain/types';

export interface RankedHypothesis {
  id: string;
  name: string;
  trust: number;
  evidenceCount: number;
  evidenceScore: number;
  rankScore: number;
  supportCount: number;
  mixedCount: number;
  nullCount: number;
  challengeCount: number;
  references: Reference[];
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function getStudyTypeQuality(studyType?: Reference['studyType']): number {
  switch (studyType) {
    case 'meta-analysis':
      return 0.9;
    case 'replication':
      return 0.8;
    case 'rct':
      return 0.75;
    case 'observational':
      return 0.6;
    case 'review':
      return 0.55;
    case 'theory':
      return 0.4;
    default:
      return 0.35;
  }
}

function getReplicationStrength(status?: Reference['replicationStatus']): number {
  switch (status) {
    case 'multi-lab':
      return 1;
    case 'independent-replication':
      return 0.8;
    case 'single':
      return 0.5;
    case 'failed-replication':
      return 0.1;
    default:
      return 0.4;
  }
}

function getDirectionScore(direction?: Reference['effectDirection']): number {
  switch (direction) {
    case 'supports':
      return 1;
    case 'mixed':
      return 0.5;
    case 'null':
      return 0.4;
    case 'challenges':
      return 0.1;
    default:
      return 0.35;
  }
}

function getQualityScore(ref: Reference): number {
  if (ref.qualityScore !== undefined) return clamp01(ref.qualityScore);

  const base = getStudyTypeQuality(ref.studyType);
  let adjust = 0;
  switch (ref.replicationStatus) {
    case 'multi-lab':
      adjust += 0.15;
      break;
    case 'independent-replication':
      adjust += 0.1;
      break;
    case 'failed-replication':
      adjust -= 0.25;
      break;
    default:
      break;
  }
  return clamp01(base + adjust);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function rankHypotheses(
  data: GraphData,
  options?: {
    includeUnreferenced?: boolean;
    includeRoot?: boolean;
  },
): RankedHypothesis[] {
  const includeUnreferenced = options?.includeUnreferenced ?? false;
  const includeRoot = options?.includeRoot ?? false;
  const refById = new Map(data.references.map((r) => [r.id, r]));

  const nodes = data.nodes.filter((node) => {
    if (!includeRoot && node.id === data.rootId) return false;
    if (!includeUnreferenced && node.referenceIds.length === 0) return false;
    return true;
  });

  const ranked: RankedHypothesis[] = nodes.map((node: GraphNode) => {
    const refs = node.referenceIds
      .map((id) => refById.get(id))
      .filter((ref): ref is Reference => Boolean(ref));

    const qualityScores = refs.map(getQualityScore);
    const directionScores = refs.map((r) => getDirectionScore(r.effectDirection));
    const replicationScores = refs.map((r) => getReplicationStrength(r.replicationStatus));
    const qualityMean = mean(qualityScores);
    const directionMean = mean(directionScores);
    const replicationMean = mean(replicationScores);

    const evidenceScore = refs.length === 0
      ? 0.35
      : clamp01((0.5 * qualityMean) + (0.3 * directionMean) + (0.2 * replicationMean));

    const trustNorm = node.trust < 0 ? 0 : clamp01(node.trust);
    const evidenceCoverage = clamp01(refs.length / 5);
    const rankScore = clamp01((0.6 * trustNorm) + (0.35 * evidenceScore) + (0.05 * evidenceCoverage));

    return {
      id: node.id,
      name: node.name,
      trust: node.trust,
      evidenceCount: refs.length,
      evidenceScore,
      rankScore,
      supportCount: refs.filter((r) => r.effectDirection === 'supports').length,
      mixedCount: refs.filter((r) => r.effectDirection === 'mixed').length,
      nullCount: refs.filter((r) => r.effectDirection === 'null').length,
      challengeCount: refs.filter((r) => r.effectDirection === 'challenges').length,
      references: refs,
    };
  });

  return ranked.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    if (b.evidenceScore !== a.evidenceScore) return b.evidenceScore - a.evidenceScore;
    return b.trust - a.trust;
  });
}
