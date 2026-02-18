import type { Reference, ReferenceClaim, ClaimDirection } from '../domain/types';

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

export function checksumText(s: string): string {
  return simpleHash(normalizeText(s));
}

function detectDirection(sentence: string): { direction: ClaimDirection; rationale: string; confidence: number } {
  const s = normalizeText(sentence);
  const contradictory = ['no evidence', 'null effect', 'not significant', 'did not', 'failed to', 'unable to'];
  const supportive = ['significant', 'supports', 'evidence', 'found', 'effect', 'improved', 'increase'];

  const contradictHit = contradictory.find((k) => s.includes(k));
  if (contradictHit) {
    return { direction: 'contradicts', rationale: `keyword:${contradictHit}`, confidence: 0.8 };
  }

  const supportHit = supportive.find((k) => s.includes(k));
  if (supportHit) {
    return { direction: 'supports', rationale: `keyword:${supportHit}`, confidence: 0.75 };
  }

  return { direction: 'null', rationale: 'no-strong-direction-keyword', confidence: 0.5 };
}

function detectContextTags(sentence: string): string[] {
  const s = normalizeText(sentence);
  const tags: string[] = [];
  const checks: Array<[string, string[]]> = [
    ['phenomenon', ['telepathy', 'precognition', 'ganzfeld', 'psi', 'remote viewing', 'presentiment']],
    ['protocol', ['protocol', 'double blind', 'registered report', 'randomized', 'task']],
    ['population', ['participants', 'students', 'sample', 'subjects', 'patients']],
    ['measurement', ['p value', 'effect size', 'hit rate', 'accuracy', 'confidence interval']],
    ['confounder', ['bias', 'artifact', 'leakage', 'file drawer', 'publication bias']],
    ['mechanism', ['mechanism', 'model', 'theory', 'process', 'causal']],
    ['failure-mode', ['failed', 'boundary', 'condition', 'replication', 'non-replication']],
  ];

  for (const [tag, words] of checks) {
    if (words.some((w) => s.includes(w))) tags.push(tag);
  }
  return tags;
}

export function extractClaimsFromAbstract(
  abstract: string,
  nowIso = new Date().toISOString(),
): ReferenceClaim[] {
  const sentences = abstract
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40)
    .slice(0, 8);

  return sentences.map((sentence, index) => {
    const direction = detectDirection(sentence);
    return {
      claimId: `clm-${index + 1}-${simpleHash(sentence).slice(0, 8)}`,
      text: sentence,
      direction: direction.direction,
      contextTags: detectContextTags(sentence),
      confidence: direction.confidence,
      rationale: direction.rationale,
      extractorModel: 'heuristic-v1',
      createdAt: nowIso,
    };
  });
}

export function extractClaimsForReference(
  ref: Reference,
  options?: { force?: boolean; nowIso?: string },
): { updated: boolean; reason: string; claimsCount: number; checksum?: string } {
  if (!ref.abstract || ref.abstract.trim().length === 0) {
    return { updated: false, reason: 'no-abstract', claimsCount: ref.claims?.length ?? 0 };
  }

  const checksum = checksumText(ref.abstract);
  const force = options?.force ?? false;
  const nowIso = options?.nowIso ?? new Date().toISOString();

  if (!force && ref.abstractChecksum === checksum && (ref.claims?.length ?? 0) > 0) {
    return {
      updated: false,
      reason: 'abstract-unchanged',
      claimsCount: ref.claims?.length ?? 0,
      checksum,
    };
  }

  const claims = extractClaimsFromAbstract(ref.abstract, nowIso);
  ref.claims = claims;
  ref.abstractChecksum = checksum;

  return {
    updated: true,
    reason: force ? 'forced-reextract' : 'extracted',
    claimsCount: claims.length,
    checksum,
  };
}
