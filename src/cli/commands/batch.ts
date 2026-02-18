import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { GraphData, GraphNode, Reference, Provenance, ReviewStatus } from '../../domain/types';
import { parseNodeType, parseEdgeType, EDGE_TYPE_IMPLICATION } from '../../domain/types';
import { propagateTrust } from '../../domain/trust';
import { canAddEdge } from '../../domain/validation';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { isDuplicate } from '../../agent/search/dedup';
import { writeAuditEntry, createAuditEntry, readTodayAuditEntries } from '../../agent/audit';
import { loadGovernanceConfig } from '../../agent/governance';
import { runPublishGate } from '../../agent/publish-validation';
import { saveSnapshot } from '../../agent/snapshot';
import { formatOutput, type OutputFormat } from '../format';

interface BatchInput {
  nodes?: Array<{
    parentId: string;
    name: string;
    description?: string;
    categoryId?: string;
    keywords?: string[];
    type?: string;
  }>;
  references?: Array<{
    title: string;
    authors?: string[];
    year?: number;
    description?: string;
    doi?: string;
    url?: string;
    abstract?: string;
    semanticScholarId?: string;
    openAlexId?: string;
    linkToNodes?: string[];
  }>;
  edges?: Array<{
    sourceId: string;
    targetId: string;
    trust?: number;
    type?: string;
  }>;
  provenance?: Partial<Provenance>;
}

function nextNodeId(data: GraphData): string {
  data.lastNodeNumber += 1;
  return `${data.prefix}${data.lastNodeNumber}`;
}

export function registerBatchCommands(program: Command) {
  const batch = program.command('batch').description('Batch operations for agent imports');

  batch
    .command('import')
    .requiredOption('--input <file>', 'JSON file with batch data')
    .option('--review-status <status>', 'Review status for imported items', 'draft')
    .option('--run-id <id>', 'Run ID for provenance', `run-${Date.now()}`)
    .option('--agent <name>', 'Agent name for provenance', 'batch-import')
    .option('--snapshot', 'Save snapshot before importing (now always enabled)')
    .option('--audit-dir <dir>', 'Directory for audit logs')
    .option('--force', 'Force import even if publish gate validation fails')
    .description('Import nodes, references, and edges from a JSON file')
    .action((cmdOpts: {
      input: string;
      reviewStatus: string;
      runId: string;
      agent: string;
      snapshot?: boolean;
      auditDir?: string;
      force?: boolean;
    }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const input: BatchInput = JSON.parse(readFileSync(cmdOpts.input, 'utf-8'));
      const reviewStatus = cmdOpts.reviewStatus as ReviewStatus;
      const runId = cmdOpts.runId;
      const auditDir = cmdOpts.auditDir ?? dirname(opts.file);

      // Always save snapshot before importing
      saveSnapshot(opts.file, data, 'pre-import', runId);

      // Run publish gate validation
      const govConfig = loadGovernanceConfig(opts.file);
      const todayAudit = readTodayAuditEntries(auditDir);
      const gateResult = runPublishGate(
        {
          nodes: input.nodes?.map((n) => ({ name: n.name, description: n.description })),
          references: input.references?.map((r) => ({ title: r.title, year: r.year, doi: r.doi, url: r.url })),
        },
        { nodes: data.nodes, references: data.references, auditEntries: todayAudit },
        govConfig,
      );

      if (!gateResult.valid && !cmdOpts.force) {
        console.error(formatOutput({
          status: 'error',
          message: 'Publish gate validation failed. Use --force to override.',
          errors: gateResult.errors,
          warnings: gateResult.warnings,
        }, opts.format as OutputFormat));
        process.exit(1);
      }

      if (gateResult.warnings.length > 0) {
        console.error(`Warnings: ${gateResult.warnings.join('; ')}`);
      }

      const provenance: Provenance = {
        source: 'agent',
        agent: cmdOpts.agent,
        timestamp: new Date().toISOString(),
        runId,
        ...input.provenance,
      };

      const summary = {
        nodesCreated: 0,
        nodesSkipped: 0,
        refsCreated: 0,
        refsSkipped: 0,
        refsDuplicate: 0,
        edgesCreated: 0,
        edgesSkipped: 0,
      };

      // Import references first (so nodes can link to them)
      const refIdMap = new Map<number, string>(); // batch index -> actual ref ID
      for (const [i, refInput] of (input.references ?? []).entries()) {
        // Check for duplicates
        const dupCheck = isDuplicate(
          {
            title: refInput.title,
            authors: refInput.authors ?? [],
            year: refInput.year ?? 0,
            doi: refInput.doi,
            semanticScholarId: refInput.semanticScholarId,
            openAlexId: refInput.openAlexId,
            source: 'semantic-scholar',
          },
          data.references,
        );

        if (dupCheck.duplicate) {
          summary.refsDuplicate++;
          refIdMap.set(i, dupCheck.matchedRefId!);
          writeAuditEntry(auditDir, createAuditEntry(
            runId, 'add-reference', 'reference', dupCheck.matchedRefId!,
            'skipped-duplicate', refInput, {
              reason: `Duplicate: ${dupCheck.matchType}`,
              aiRationale: `Dedup matched via ${dupCheck.matchType}`,
              validationErrors: [`Duplicate reference: ${dupCheck.matchType} match with ${dupCheck.matchedRefId}`],
            },
          ));
          continue;
        }

        const refId = `ref-${Date.now()}-${i}`;
        const newRef: Reference = {
          id: refId,
          title: refInput.title,
          authors: refInput.authors ?? [],
          year: refInput.year ?? 0,
          publication: '',
          publisher: '',
          citation: '',
          pageStart: 0,
          pageEnd: 0,
          volume: 0,
          description: refInput.description ?? '',
          doi: refInput.doi ?? '',
          url: refInput.url ?? '',
          semanticScholarId: refInput.semanticScholarId ?? '',
          openAlexId: refInput.openAlexId ?? '',
          abstract: refInput.abstract ?? '',
          provenance,
          reviewStatus,
        };
        data.references.push(newRef);
        refIdMap.set(i, refId);
        summary.refsCreated++;

        writeAuditEntry(auditDir, createAuditEntry(
          runId, 'add-reference', 'reference', refId, 'accepted', { title: refInput.title, doi: refInput.doi },
          { aiRationale: 'Passed publish gate validation', validationErrors: [] },
        ));

        // Link to nodes
        for (const nodeId of refInput.linkToNodes ?? []) {
          const node = data.nodes.find((n) => n.id === nodeId);
          if (node && !node.referenceIds.includes(refId)) {
            node.referenceIds.push(refId);
          }
        }
      }

      // Import nodes
      const nodeIdMap = new Map<number, string>(); // batch index -> actual node ID
      for (const [i, nodeInput] of (input.nodes ?? []).entries()) {
        const parentId = nodeInput.parentId;
        const parent = data.nodes.find((n) => n.id === parentId);
        if (!parent) {
          summary.nodesSkipped++;
          writeAuditEntry(auditDir, createAuditEntry(
            runId, 'add-node', 'node', '', 'rejected', nodeInput, {
              reason: `Parent ${parentId} not found`,
              validationErrors: [`Parent node ${parentId} does not exist in graph`],
            },
          ));
          continue;
        }

        const nodeId = nextNodeId(data);
        const newNode: GraphNode = {
          id: nodeId,
          name: nodeInput.name,
          description: nodeInput.description ?? '',
          categoryId: nodeInput.categoryId ?? 'general',
          keywords: nodeInput.keywords ?? [],
          type: parseNodeType(nodeInput.type ?? 'regular'),
          trust: -1,
          referenceIds: [],
          provenance,
          reviewStatus,
        };
        data.nodes.push(newNode);
        nodeIdMap.set(i, nodeId);

        // Create edge from parent
        const edgeId = `${parentId}-${nodeId}`;
        data.edges.push({
          id: edgeId,
          sourceId: parentId,
          targetId: nodeId,
          trust: -1,
          type: EDGE_TYPE_IMPLICATION,
          combinedTrust: -1,
        });

        summary.nodesCreated++;
        writeAuditEntry(auditDir, createAuditEntry(
          runId, 'add-node', 'node', nodeId, 'accepted', { name: nodeInput.name, parentId },
          { aiRationale: 'Passed publish gate validation', validationErrors: [] },
        ));
      }

      // Import edges
      for (const edgeInput of input.edges ?? []) {
        const check = canAddEdge(edgeInput.sourceId, edgeInput.targetId, data.edges);
        if (!check.ok) {
          summary.edgesSkipped++;
          writeAuditEntry(auditDir, createAuditEntry(
            runId, 'add-edge', 'edge', '', 'rejected', edgeInput, {
              reason: check.reason,
              validationErrors: [check.reason ?? 'Edge validation failed'],
            },
          ));
          continue;
        }

        const edgeId = `${edgeInput.sourceId}-${edgeInput.targetId}`;
        data.edges.push({
          id: edgeId,
          sourceId: edgeInput.sourceId,
          targetId: edgeInput.targetId,
          trust: edgeInput.trust ?? -1,
          type: parseEdgeType(edgeInput.type ?? 'implication'),
          combinedTrust: -1,
          provenance,
        });
        summary.edgesCreated++;
        writeAuditEntry(auditDir, createAuditEntry(
          runId, 'add-edge', 'edge', edgeId, 'accepted', edgeInput,
          { aiRationale: 'Edge validation passed', validationErrors: [] },
        ));
      }

      // Propagate trust
      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      // Update metadata
      if (!data.metadata) data.metadata = {};
      data.metadata.lastAgentRun = new Date().toISOString();
      data.metadata.lastAgentRunId = runId;
      data.metadata.totalAgentRuns = (data.metadata.totalAgentRuns ?? 0) + 1;

      // Check daily cap after import and warn if approaching limit
      const today = new Date().toISOString().slice(0, 10);
      const todayNodeCount = data.nodes.filter(
        (n) => n.provenance?.timestamp?.startsWith(today),
      ).length;
      const remaining = Math.max(0, govConfig.maxDailyNewNodes - todayNodeCount);
      if (remaining <= 5) {
        console.error(`Warning: Approaching daily node cap — ${remaining} nodes remaining (${todayNodeCount}/${govConfig.maxDailyNewNodes})`);
      }

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput({ status: 'ok', ...summary, dailyCapRemaining: remaining }, opts.format as OutputFormat));
    });
}
