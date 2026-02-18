import {
  EDGE_TYPE_IMPLICATION,
  type GraphData,
  type GraphNode,
  type Reference,
  type ReviewStatus,
} from '../domain/types';
import { propagateTrust } from '../domain/trust';
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
  autoNodeGrowth?: boolean;
  maxNewNodes?: number;
  minNodeConfidence?: number;
  nodeReviewStatus?: ReviewStatus;
  nodeSimilarityThreshold?: number;
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
  nodesProposed: number;
  nodesCreated: number;
  nodeDuplicates: number;
  nodeRejected: number;
  importedRefIds: string[];
  createdNodeIds: string[];
  skipReasons: Array<{
    code: string;
    count: number;
    sampleCandidateIds: string[];
  }>;
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
  nodeDetails: Array<{
    candidateId: string;
    refId: string;
    decision: 'created' | 'duplicate' | 'rejected' | 'skipped';
    nodeId?: string;
    parentNodeId?: string;
    confidence?: number;
    reason: string;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const STOPWORDS = new Set([
  'about', 'after', 'against', 'among', 'because', 'before', 'between', 'beyond', 'could', 'during',
  'effects', 'findings', 'from', 'into', 'might', 'paper', 'review', 'results', 'study', 'their',
  'there', 'these', 'those', 'through', 'using', 'with', 'within',
]);

function uniqueTokens(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenize(input)) {
    if (STOPWORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function tokenJaccardScore(a: string, b: string): number {
  const aTokens = new Set(uniqueTokens(a));
  const bTokens = new Set(uniqueTokens(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared++;
  }
  const union = aTokens.size + bTokens.size - shared;
  return union === 0 ? 0 : shared / union;
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

function deriveNodeName(title: string): string {
  const trimmed = title.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'Discovered Psi Topic';
  const primary = trimmed.split(':')[0].trim();
  let selected = primary.length >= 12 && primary.length <= 90 ? primary : trimmed;
  selected = selected.replace(/[.;,:-]+$/, '').trim();
  if (selected.length <= 100) return selected;
  const cut = selected.slice(0, 100);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim();
}

function deriveNodeKeywords(candidate: DiscoveryEvent, scopeKeywords: string[]): string[] {
  const base = uniqueTokens(`${candidate.query} ${candidate.title} ${candidate.abstract ?? ''}`);
  const matchedScope = scopeKeywords.filter((kw) => buildCandidateCorpus(candidate).includes(kw));
  return [...new Set([...matchedScope.flatMap((kw) => uniqueTokens(kw)), ...base])].slice(0, 12);
}

function nextNodeId(data: GraphData): string {
  data.lastNodeNumber += 1;
  return `${data.prefix}${data.lastNodeNumber}`;
}

function nextEdgeId(data: GraphData, parentId: string, childId: string): string {
  const base = `${parentId}-${childId}`;
  if (!data.edges.some((edge) => edge.id === base)) return base;
  let suffix = 2;
  while (data.edges.some((edge) => edge.id === `${base}-${suffix}`)) {
    suffix++;
  }
  return `${base}-${suffix}`;
}

function bestParentForCandidate(candidate: DiscoveryEvent, nodes: GraphNode[], rootId: string): GraphNode {
  const ranked = nodes
    .filter((node) => node.id !== 'P1' && node.id !== 'M1')
    .map((node) => ({ node, score: computeNodeLinkScore(candidate, node) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.node ?? nodes.find((node) => node.id === rootId) ?? nodes[0];
}

function detectNodeDuplicate(
  proposedName: string,
  proposedKeywords: string[],
  nodes: GraphNode[],
  threshold: number,
): { duplicate: boolean; reason?: string; matchedNodeId?: string } {
  const proposedNameNorm = normalizeText(proposedName);
  const proposedAlias = normalizeText(proposedKeywords.join(' '));
  for (const node of nodes) {
    const nodeNameNorm = normalizeText(node.name);
    if (nodeNameNorm === proposedNameNorm) {
      return {
        duplicate: true,
        reason: `node-name-exact-match:${node.id}`,
        matchedNodeId: node.id,
      };
    }

    const aliasSimilarity = tokenJaccardScore(proposedAlias, `${node.name} ${node.keywords.join(' ')}`);
    if (proposedKeywords.length > 0 && aliasSimilarity >= 0.8) {
      return {
        duplicate: true,
        reason: `node-alias-overlap:${node.id}`,
        matchedNodeId: node.id,
      };
    }

    const semanticSimilarity = tokenJaccardScore(proposedName, node.name);
    if (semanticSimilarity >= threshold) {
      return {
        duplicate: true,
        reason: `node-semantic-similarity:${node.id}:${semanticSimilarity.toFixed(2)}`,
        matchedNodeId: node.id,
      };
    }
  }
  return { duplicate: false };
}

function computeNodeConfidence(
  candidate: DiscoveryEvent,
  scope: { classification: 'in-scope-core' | 'in-scope-adjacent' | 'out-of-scope'; scopeScore: number },
  parent: GraphNode,
  scopeKeywords: string[],
): { confidence: number; weakScopeFallbackUsed: boolean } {
  const corpus = buildCandidateCorpus(candidate);
  const scopeMatchCount = scopeKeywords.filter((kw) => corpus.includes(kw)).length;
  const scopeSignal = clamp(scope.scopeScore / 6, 0, 1);
  const parentSignal = clamp(computeNodeLinkScore(candidate, parent) / 5, 0, 1);
  const lexicalSignal = tokenJaccardScore(candidate.title, `${parent.name} ${parent.keywords.join(' ')}`);
  const keywordSignal = scopeKeywords.length === 0 ? 0 : clamp(scopeMatchCount / Math.max(scopeKeywords.length, 1), 0, 1);

  let confidence = (scopeSignal * 0.35) + (parentSignal * 0.25) + (lexicalSignal * 0.25) + (keywordSignal * 0.15);
  let weakScopeFallbackUsed = false;
  if (scope.classification === 'out-of-scope') {
    weakScopeFallbackUsed = true;
    confidence = (parentSignal * 0.45) + (lexicalSignal * 0.45) + (keywordSignal * 0.10);
    confidence *= 0.85;
  }

  return { confidence: clamp(confidence, 0, 1), weakScopeFallbackUsed };
}

function addSkipReason(reasons: Map<string, Set<string>>, code: string, candidateId: string): void {
  const bucket = reasons.get(code) ?? new Set<string>();
  bucket.add(candidateId);
  reasons.set(code, bucket);
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
  const autoNodeGrowth = opts.autoNodeGrowth ?? false;
  const maxNewNodes = opts.maxNewNodes ?? 0;
  const minNodeConfidence = clamp(opts.minNodeConfidence ?? 0.72, 0, 1);
  const nodeReviewStatus = opts.nodeReviewStatus ?? 'approved';
  const nodeSimilarityThreshold = clamp(opts.nodeSimilarityThreshold ?? 0.82, 0, 1);
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
  let nodesProposed = 0;
  let nodesCreated = 0;
  let nodeDuplicates = 0;
  let nodeRejected = 0;
  const importedRefIds: string[] = [];
  const createdNodeIds: string[] = [];
  const skipReasons = new Map<string, Set<string>>();
  const details: DiscoveryImportResult['details'] = [];
  const nodeDetails: DiscoveryImportResult['nodeDetails'] = [];

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

    if (!autoNodeGrowth) {
      addSkipReason(skipReasons, 'node-growth-disabled', candidate.candidateId);
      nodeDetails.push({
        candidateId: candidate.candidateId,
        refId,
        decision: 'skipped',
        reason: 'node-growth-disabled',
      });
    } else if (nodesCreated >= maxNewNodes) {
      addSkipReason(skipReasons, 'max-new-nodes-per-run-reached', candidate.candidateId);
      nodeDetails.push({
        candidateId: candidate.candidateId,
        refId,
        decision: 'skipped',
        reason: 'max-new-nodes-per-run-reached',
      });
    } else {
      nodesProposed++;
      const parentNode = bestParentForCandidate(candidate, opts.data.nodes, opts.data.rootId);
      const proposedName = deriveNodeName(candidate.title);
      const proposedKeywords = deriveNodeKeywords(candidate, scopeKeywords);
      const confidenceResult = computeNodeConfidence(candidate, scope, parentNode, scopeKeywords);
      const effectiveThreshold = confidenceResult.weakScopeFallbackUsed
        ? clamp(minNodeConfidence + 0.1, 0, 1)
        : minNodeConfidence;

      if (confidenceResult.confidence < effectiveThreshold) {
        addSkipReason(skipReasons, 'low-node-confidence', candidate.candidateId);
        nodeDetails.push({
          candidateId: candidate.candidateId,
          refId,
          decision: 'skipped',
          parentNodeId: parentNode.id,
          confidence: confidenceResult.confidence,
          reason: `low-node-confidence:${confidenceResult.confidence.toFixed(2)}<${effectiveThreshold.toFixed(2)}`,
        });
      } else {
        const duplicateCheck = detectNodeDuplicate(
          proposedName,
          proposedKeywords,
          opts.data.nodes,
          nodeSimilarityThreshold,
        );
        if (duplicateCheck.duplicate) {
          nodeDuplicates++;
          addSkipReason(skipReasons, 'node-duplicate', candidate.candidateId);
          writeAuditEntry(opts.baseDir, createAuditEntry(
            opts.runId,
            'discovery-import-node',
            'node',
            duplicateCheck.matchedNodeId ?? candidate.candidateId,
            'skipped-duplicate',
            { candidateId: candidate.candidateId, title: candidate.title, matchedNodeId: duplicateCheck.matchedNodeId },
            {
              reason: duplicateCheck.reason,
              aiRationale: 'Auto node growth duplicate guard',
              validationErrors: [],
            },
          ));
          nodeDetails.push({
            candidateId: candidate.candidateId,
            refId,
            decision: 'duplicate',
            parentNodeId: parentNode.id,
            confidence: confidenceResult.confidence,
            reason: duplicateCheck.reason ?? 'node-duplicate',
          });
        } else {
          const nodeDescription = (candidate.abstract ?? '').trim().slice(0, 300);
          const gate = runPublishGate(
            {
              nodes: [{
                name: proposedName,
                description: nodeDescription.length > 0 ? nodeDescription : `Discovered from "${candidate.query}"`,
                categoryId: parentNode.categoryId,
                keywords: proposedKeywords,
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
            nodeRejected++;
            const reason = gate.errors[0] ?? 'node-publish-gate-rejected';
            addSkipReason(skipReasons, 'node-governance-rejected', candidate.candidateId);
            writeAuditEntry(opts.baseDir, createAuditEntry(
              opts.runId,
              'discovery-import-node',
              'node',
              candidate.candidateId,
              'rejected',
              { candidateId: candidate.candidateId, title: candidate.title, proposedName },
              {
                reason,
                aiRationale: 'Publish gate rejected auto-grown node',
                validationErrors: gate.errors,
              },
            ));
            nodeDetails.push({
              candidateId: candidate.candidateId,
              refId,
              decision: 'rejected',
              parentNodeId: parentNode.id,
              confidence: confidenceResult.confidence,
              reason,
            });
          } else {
            const nodeId = nextNodeId(opts.data);
            const edgeId = nextEdgeId(opts.data, parentNode.id, nodeId);
            const timestamp = new Date().toISOString();
            opts.data.nodes.push({
              id: nodeId,
              name: proposedName,
              description: nodeDescription.length > 0 ? nodeDescription : `Discovered from "${candidate.query}"`,
              categoryId: parentNode.categoryId,
              keywords: proposedKeywords,
              type: 0,
              trust: -1,
              referenceIds: [refId],
              provenance: {
                source: 'agent',
                agent: 'discovery-import-node-growth',
                timestamp,
                runId: opts.runId,
                searchQuery: candidate.query,
                apiSource: candidate.source,
                aiClassification: scope.classification,
                mappingConfidence: confidenceResult.confidence,
              },
              reviewStatus: nodeReviewStatus,
              status: 'active',
            });
            opts.data.edges.push({
              id: edgeId,
              sourceId: parentNode.id,
              targetId: nodeId,
              trust: -1,
              type: EDGE_TYPE_IMPLICATION,
              combinedTrust: -1,
              provenance: {
                source: 'agent',
                agent: 'discovery-import-node-growth',
                timestamp,
                runId: opts.runId,
                searchQuery: candidate.query,
                apiSource: candidate.source,
                aiClassification: scope.classification,
                mappingConfidence: confidenceResult.confidence,
              },
            });
            const propagated = propagateTrust(opts.data.nodes, opts.data.edges, opts.data.rootId);
            opts.data.nodes = propagated.nodes;
            opts.data.edges = propagated.edges;

            nodesCreated++;
            createdNodeIds.push(nodeId);
            writeAuditEntry(opts.baseDir, createAuditEntry(
              opts.runId,
              'discovery-import-node',
              'node',
              nodeId,
              'accepted',
              {
                nodeId,
                parentNodeId: parentNode.id,
                fromCandidateId: candidate.candidateId,
                refId,
                confidence: confidenceResult.confidence,
              },
              {
                aiRationale: 'Auto-created node from imported discovery candidate',
                validationErrors: gate.warnings,
              },
            ));
            nodeDetails.push({
              candidateId: candidate.candidateId,
              refId,
              decision: 'created',
              nodeId,
              parentNodeId: parentNode.id,
              confidence: confidenceResult.confidence,
              reason: `created-node:${nodeId}`,
            });
          }
        }
      }
    }

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
    nodesProposed,
    nodesCreated,
    nodeDuplicates,
    nodeRejected,
    importedRefIds,
    createdNodeIds,
    skipReasons: [...skipReasons.entries()].map(([code, ids]) => ({
      code,
      count: ids.size,
      sampleCandidateIds: [...ids].slice(0, 5),
    })),
    details,
    nodeDetails,
  };
}
