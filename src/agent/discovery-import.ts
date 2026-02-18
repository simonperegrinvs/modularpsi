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
}

export interface DiscoveryImportResult {
  runId: string;
  sourceRunId?: string;
  scannedQueued: number;
  attempted: number;
  imported: number;
  duplicates: number;
  rejected: number;
  linkedNodeCount: number;
  importedRefIds: string[];
  details: Array<{
    candidateId: string;
    title: string;
    decision: 'imported-draft' | 'duplicate' | 'rejected';
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
): void {
  const now = new Date().toISOString();
  writeDiscoveryEvent(baseDir, {
    ...candidate,
    action: 'decision-update',
    timestamp: now,
    runId,
    decision,
    decisionReason,
    discoveredAt: candidate.discoveredAt || now,
  });
}

function processingStatusForReview(status: ReviewStatus): Reference['processingStatus'] {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'imported-draft';
}

export function importQueuedDiscoveryCandidates(opts: DiscoveryImportOptions): DiscoveryImportResult {
  const queued = listDiscoveryCandidates(opts.baseDir, {
    date: opts.date,
    status: 'queued',
    runId: opts.sourceRunId,
  });
  const attempted = queued.slice(0, Math.max(0, opts.maxItems));
  const maxLinkedNodes = opts.maxLinkedNodes ?? 2;

  let imported = 0;
  let duplicates = 0;
  let rejected = 0;
  let linkedNodeCount = 0;
  const importedRefIds: string[] = [];
  const details: DiscoveryImportResult['details'] = [];

  for (const [index, candidate] of attempted.entries()) {
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
        writeDecisionUpdate(opts.baseDir, candidate, opts.runId, 'duplicate', reason);
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
          reason,
        });
        continue;
      }

      rejected++;
      writeDecisionUpdate(opts.baseDir, candidate, opts.runId, 'rejected', reason);
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
        aiClassification: candidate.classification,
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

    writeDecisionUpdate(opts.baseDir, candidate, opts.runId, 'imported-draft', `imported as ${refId}`);
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
    linkedNodeCount,
    importedRefIds,
    details,
  };
}
