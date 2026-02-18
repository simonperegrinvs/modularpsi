import type { GraphData, GraphNode, Reference, ReviewStatus } from '../domain/types';
import type { AuditEntry } from './audit';
import { createAuditEntry, writeAuditEntry } from './audit';
import { listDiscoveryCandidates, writeDiscoveryEvent, type DiscoveryEvent } from './discovery';
import { runPublishGate, type PublishGateConfig } from './publish-validation';

export interface DiscoveryImportOptions {
  baseDir: string;
  data: GraphData;
  governanceConfig: PublishGateConfig;
  auditEntries: AuditEntry[];
  runId: string;
  reviewStatus: ReviewStatus;
  sourceRunId?: string;
  date?: string;
  maxItems: number;
  maxLinkedNodes?: number;
  scopeKeywords?: string[];
  excludeKeywords?: string[];
  minScopeScore?: number;
  enforceScopeFilter?: boolean;
}

export interface DiscoveryImportResult {
  runId: string;
  sourceRunId?: string;
  scannedQueued: number;
  attempted: number;
  imported: number;
  duplicates: number;
  rejected: number;
  outOfScope: number;
  linkedNodeCount: number;
  importedRefIds: string[];
  details: Array<{
    candidateId: string;
    title: string;
    decision: 'imported-draft' | 'duplicate' | 'rejected';
    classification?: 'in-scope-core' | 'in-scope-adjacent' | 'out-of-scope';
    scopeScore?: number;
    reason?: string;
    refId?: string;
    linkedNodeIds?: string[];
  }>;
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(input: string): string[] {
  return normalizeText(input).split(' ').filter((token) => token.length >= 4);
}

function uniqNormalizedKeywords(items: string[] | undefined): string[] {
  if (!items || items.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function buildCandidateCorpus(candidate: DiscoveryEvent): string {
  return normalizeText([candidate.query, candidate.title, candidate.abstract ?? ''].join(' '));
}

function candidateToReferenceTemplate(candidate: DiscoveryEvent): Pick<
Reference,
'title' | 'authors' | 'year' | 'description' | 'doi' | 'url' | 'semanticScholarId' | 'openAlexId' | 'abstract'
> {
  return {
    title: candidate.title.trim(),
    authors: candidate.authors ?? [],
    year: candidate.year ?? 0,
    description: `Discovered from query "${candidate.query}"`,
    doi: candidate.doi ?? '',
    url: candidate.url ?? '',
    semanticScholarId: candidate.semanticScholarId ?? '',
    openAlexId: candidate.openAlexId ?? '',
    abstract: candidate.abstract ?? '',
  };
}

function computeNodeLinkScore(candidate: DiscoveryEvent, node: GraphNode): number {
  const corpus = buildCandidateCorpus(candidate);
  const nodeName = normalizeText(node.name);
  const nodeTokens = new Set(tokenize(`${node.name} ${node.keywords.join(' ')}`));
  const corpusTokens = new Set(tokenize(corpus));

  let score = 0;
  if (nodeName.length > 0 && (corpus.includes(nodeName) || nodeName.includes(corpus))) {
    score += 2;
  }
  for (const token of nodeTokens) {
    if (corpusTokens.has(token)) score++;
  }
  return score;
}

export function suggestNodeLinksForCandidate(
  candidate: DiscoveryEvent,
  nodes: GraphNode[],
  maxLinkedNodes = 2,
): string[] {
  const ranked = nodes
    .filter((node) => node.id !== 'P1' && node.id !== 'M1')
    .map((node) => ({ nodeId: node.id, score: computeNodeLinkScore(candidate, node) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxLinkedNodes));

  return ranked.map((item) => item.nodeId);
}

function writeDecisionUpdate(
  baseDir: string,
  candidate: DiscoveryEvent,
  runId: string,
  decision: DiscoveryEvent['decision'],
  decisionReason: string,
  classification?: DiscoveryEvent['classification'],
): void {
  const now = new Date().toISOString();
  writeDiscoveryEvent(baseDir, {
    ...candidate,
    action: 'decision-update',
    timestamp: now,
    runId,
    decision,
    decisionReason,
    classification: classification ?? candidate.classification,
    discoveredAt: candidate.discoveredAt || now,
  });
}

function processingStatusForReview(status: ReviewStatus): Reference['processingStatus'] {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'imported-draft';
}

function classifyScope(
  candidate: DiscoveryEvent,
  nodes: GraphNode[],
  scopeKeywords: string[],
  excludeKeywords: string[],
  minScopeScore: number,
): {
  classification: 'in-scope-core' | 'in-scope-adjacent' | 'out-of-scope';
  scopeScore: number;
  reason?: string;
} {
  const corpus = buildCandidateCorpus(candidate);
  const matchedScope = scopeKeywords.filter((kw) => corpus.includes(kw));
  const matchedExclude = excludeKeywords.filter((kw) => corpus.includes(kw));
  const topNodeScore = nodes
    .filter((node) => node.id !== 'P1' && node.id !== 'M1')
    .map((node) => computeNodeLinkScore(candidate, node))
    .sort((a, b) => b - a)[0] ?? 0;

  const scopeScore = (matchedScope.length * 2) + Math.min(3, topNodeScore);
  if (matchedExclude.length > 0) {
    return {
      classification: 'out-of-scope',
      scopeScore,
      reason: `matched exclude keywords: ${matchedExclude.join(', ')}`,
    };
  }
  if (scopeScore >= minScopeScore + 2) {
    return { classification: 'in-scope-core', scopeScore };
  }
  if (scopeScore >= minScopeScore) {
    return { classification: 'in-scope-adjacent', scopeScore };
  }
  return {
    classification: 'out-of-scope',
    scopeScore,
    reason: `scope score ${scopeScore} below minimum ${minScopeScore}`,
  };
}

export function importQueuedDiscoveryCandidates(opts: DiscoveryImportOptions): DiscoveryImportResult {
  const queued = listDiscoveryCandidates(opts.baseDir, {
    date: opts.date,
    status: 'queued',
    runId: opts.sourceRunId,
  });
  const maxLinkedNodes = opts.maxLinkedNodes ?? 2;
  const scopeKeywords = uniqNormalizedKeywords(opts.scopeKeywords);
  const excludeKeywords = uniqNormalizedKeywords(opts.excludeKeywords);
  const minScopeScore = opts.minScopeScore ?? 2;
  const enforceScopeFilter = opts.enforceScopeFilter ?? true;
  const ranked = queued.map((candidate) => ({
    candidate,
    scope: classifyScope(candidate, opts.data.nodes, scopeKeywords, excludeKeywords, minScopeScore),
  }));
  ranked.sort((a, b) => {
    if (b.scope.scopeScore !== a.scope.scopeScore) return b.scope.scopeScore - a.scope.scopeScore;
    return b.candidate.timestamp.localeCompare(a.candidate.timestamp);
  });
  const attempted = ranked.slice(0, Math.max(0, opts.maxItems));

  let imported = 0;
  let duplicates = 0;
  let rejected = 0;
  let outOfScope = 0;
  let linkedNodeCount = 0;
  const importedRefIds: string[] = [];
  const details: DiscoveryImportResult['details'] = [];

  for (const [index, item] of attempted.entries()) {
    const candidate = item.candidate;
    const scope = item.scope;
    if (enforceScopeFilter && scope.classification === 'out-of-scope') {
      outOfScope++;
      rejected++;
      const reason = `out-of-scope-auto-filter: ${scope.reason ?? 'scope policy rejected candidate'}`;
      writeDecisionUpdate(opts.baseDir, candidate, opts.runId, 'rejected', reason, 'out-of-scope');
      writeAuditEntry(opts.baseDir, createAuditEntry(
        opts.runId,
        'discovery-import-reference',
        'reference',
        candidate.candidateId,
        'rejected',
        { candidateId: candidate.candidateId, title: candidate.title },
        { reason, aiRationale: 'Auto-scope filter rejected candidate before import', validationErrors: [] },
      ));
      details.push({
        candidateId: candidate.candidateId,
        title: candidate.title,
        decision: 'rejected',
        classification: 'out-of-scope',
        scopeScore: scope.scopeScore,
        reason,
      });
      continue;
    }

    const refTemplate = candidateToReferenceTemplate(candidate);
    const gate = runPublishGate(
      {
        references: [{
          title: refTemplate.title,
          authors: refTemplate.authors,
          year: refTemplate.year,
          doi: refTemplate.doi,
          url: refTemplate.url,
          semanticScholarId: refTemplate.semanticScholarId,
          openAlexId: refTemplate.openAlexId,
        }],
      },
      {
        nodes: opts.data.nodes,
        references: opts.data.references,
        auditEntries: opts.auditEntries,
      },
      opts.governanceConfig,
    );

    if (!gate.valid) {
      const duplicateError = gate.errors.find((error) => error.includes('Duplicate reference detected'));
      const reason = duplicateError ?? gate.errors[0] ?? 'publish-gate-rejected';

      if (duplicateError) {
        duplicates++;
        writeDecisionUpdate(opts.baseDir, candidate, opts.runId, 'duplicate', reason, scope.classification);
        writeAuditEntry(opts.baseDir, createAuditEntry(
          opts.runId,
          'discovery-import-reference',
          'reference',
          candidate.candidateId,
          'skipped-duplicate',
          { candidateId: candidate.candidateId, title: candidate.title },
          { reason, validationErrors: gate.errors, aiRationale: 'Publish gate duplicate rejection' },
        ));
        details.push({
          candidateId: candidate.candidateId,
          title: candidate.title,
          decision: 'duplicate',
          classification: scope.classification,
          scopeScore: scope.scopeScore,
          reason,
        });
        continue;
      }

      rejected++;
      writeDecisionUpdate(opts.baseDir, candidate, opts.runId, 'rejected', reason, scope.classification);
      writeAuditEntry(opts.baseDir, createAuditEntry(
        opts.runId,
        'discovery-import-reference',
        'reference',
        candidate.candidateId,
        'rejected',
        { candidateId: candidate.candidateId, title: candidate.title },
        { reason, validationErrors: gate.errors, aiRationale: 'Publish gate rejected candidate' },
      ));
      details.push({
        candidateId: candidate.candidateId,
        title: candidate.title,
        decision: 'rejected',
        classification: scope.classification,
        scopeScore: scope.scopeScore,
        reason,
      });
      continue;
    }

    const refId = `ref-${Date.now()}-${index}`;
    const provenanceTimestamp = new Date().toISOString();
    const newRef: Reference = {
      id: refId,
      title: refTemplate.title,
      authors: refTemplate.authors,
      year: refTemplate.year,
      publication: '',
      publisher: '',
      citation: '',
      pageStart: 0,
      pageEnd: 0,
      volume: 0,
      description: refTemplate.description,
      doi: refTemplate.doi,
      url: refTemplate.url,
      semanticScholarId: refTemplate.semanticScholarId,
      openAlexId: refTemplate.openAlexId,
      abstract: refTemplate.abstract,
      provenance: {
        source: 'agent',
        agent: 'discovery-import',
        timestamp: provenanceTimestamp,
        runId: opts.runId,
        searchQuery: candidate.query,
        apiSource: candidate.source,
        aiClassification: scope.classification,
      },
      reviewStatus: opts.reviewStatus,
      processingStatus: processingStatusForReview(opts.reviewStatus),
      discoveryCandidateId: candidate.candidateId,
    };
    opts.data.references.push(newRef);

    const linkedNodeIds = suggestNodeLinksForCandidate(candidate, opts.data.nodes, maxLinkedNodes);
    for (const nodeId of linkedNodeIds) {
      const node = opts.data.nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      if (!node.referenceIds.includes(refId)) {
        node.referenceIds.push(refId);
      }
    }

    linkedNodeCount += linkedNodeIds.length;
    imported++;
    importedRefIds.push(refId);

    writeDecisionUpdate(
      opts.baseDir,
      candidate,
      opts.runId,
      'imported-draft',
      `imported as ${refId}`,
      scope.classification,
    );
    writeAuditEntry(opts.baseDir, createAuditEntry(
      opts.runId,
      'discovery-import-reference',
      'reference',
      refId,
      'accepted',
      { refId, title: candidate.title, candidateId: candidate.candidateId, linkedNodeIds },
      {
        aiRationale: 'Queued discovery candidate imported to draft reference',
        validationErrors: [],
      },
    ));

    details.push({
      candidateId: candidate.candidateId,
      title: candidate.title,
      decision: 'imported-draft',
      classification: scope.classification,
      scopeScore: scope.scopeScore,
      reason: `imported as ${refId}`,
      refId,
      linkedNodeIds,
    });
  }

  return {
    runId: opts.runId,
    sourceRunId: opts.sourceRunId,
    scannedQueued: queued.length,
    attempted: attempted.length,
    imported,
    duplicates,
    rejected,
    outOfScope,
    linkedNodeCount,
    importedRefIds,
    details,
  };
}
