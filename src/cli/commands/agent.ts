import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { graphToJson, jsonToGraph } from '../../io/json-io';
import { loadAgentState, resetAgentState, saveAgentState } from '../../agent/state';
import { loadAgentConfig, saveAgentConfig } from '../../agent/config';
import { getCitations, resolveDoi, searchLiterature, type ApiSource } from '../../agent/search';
import { loadGovernanceConfig } from '../../agent/governance';
import { readTodayAuditEntries } from '../../agent/audit';
import {
  deriveStateFromDiscovery,
  listDiscoveryCandidates,
  listDiscoveryDates,
  readDiscoveryEvents,
  retryDiscoveryCandidate,
  summarizeDiscovery,
} from '../../agent/discovery';
import { runDiscoveryIngestion } from '../../agent/discovery-run';
import { importQueuedDiscoveryCandidates } from '../../agent/discovery-import';
import { extractClaimsForReference } from '../../agent/claims';
import { writeRunNote } from '../../agent/run-notes';
import { summarizeHypothesisContradictions, summarizeNodeContradictions } from '../../agent/contradictions';
import { buildMetricsReport, type MetricsPeriod } from '../../agent/metrics';
import { formatOutput, type OutputFormat } from '../format';
import type { ReviewStatus } from '../../domain/types';

function uniqStrings(items: Array<string | undefined>): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const trimmed = (item ?? '').trim();
    if (!trimmed) continue;
    set.add(trimmed);
  }
  return [...set];
}

export function registerAgentCommands(program: Command) {
  const agent = program.command('agent').description('Agent management and diagnostics');

  agent
    .command('status')
    .description('Show agent status: last run, pending items, summary')
    .action(() => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const state = loadAgentState(opts.file);
      const config = loadAgentConfig(opts.file);

      const draftNodes = data.nodes.filter((n) => n.reviewStatus === 'draft').length;
      const pendingNodes = data.nodes.filter((n) => n.reviewStatus === 'pending-review').length;
      const draftRefs = data.references.filter((r) => r.reviewStatus === 'draft').length;
      const pendingRefs = data.references.filter((r) => r.reviewStatus === 'pending-review').length;

      console.log(formatOutput({
        lastRun: state.lastRunTimestamp || 'never',
        lastRunId: state.lastRunId || 'none',
        totalRuns: state.totalRuns,
        totalNodes: data.nodes.length,
        totalEdges: data.edges.length,
        totalRefs: data.references.length,
        draftNodes,
        pendingNodes,
        draftRefs,
        pendingRefs,
        recentQueries: state.recentSearchQueries.slice(-5),
        configuredApis: config.searchApis,
      }, opts.format as OutputFormat));
    });

  agent
    .command('gaps')
    .description('Identify nodes that need more evidence or references')
    .action(() => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      // Nodes with no references
      const noRefs = data.nodes
        .filter((n) => n.referenceIds.length === 0 && n.description)
        .map((n) => ({ id: n.id, name: n.name, issue: 'no-references', trust: n.trust }));

      // Nodes with empty description
      const noDesc = data.nodes
        .filter((n) => !n.description)
        .map((n) => ({ id: n.id, name: n.name, issue: 'no-description', trust: n.trust }));

      // Nodes with unclassified trust (leaf nodes with trust=-1)
      const unclassified = data.nodes
        .filter((n) => n.trust < 0)
        .map((n) => ({ id: n.id, name: n.name, issue: 'unclassified-trust', trust: n.trust }));

      // Edges with unclassified trust
      const unclassifiedEdges = data.edges
        .filter((e) => e.trust < 0)
        .map((e) => ({ id: e.id, source: e.sourceId, target: e.targetId, issue: 'unclassified-edge-trust' }));

      console.log(formatOutput({
        noReferences: noRefs,
        noDescription: noDesc,
        unclassifiedTrust: unclassified,
        unclassifiedEdges: unclassifiedEdges,
        summary: {
          nodesWithoutRefs: noRefs.length,
          nodesWithoutDesc: noDesc.length,
          unclassifiedNodes: unclassified.length,
          unclassifiedEdges: unclassifiedEdges.length,
        },
      }, opts.format as OutputFormat));
    });

  agent
    .command('state')
    .description('Show raw agent state')
    .action(() => {
      const opts = program.opts();
      const state = loadAgentState(opts.file);
      console.log(formatOutput(state, opts.format as OutputFormat));
    });

  agent
    .command('reset')
    .description('Reset agent state')
    .action(() => {
      const opts = program.opts();
      resetAgentState(opts.file);
      console.log(formatOutput({ status: 'ok', message: 'Agent state reset' }, opts.format as OutputFormat));
    });

  agent
    .command('config')
    .option('--show', 'Show current config')
    .option('--set <key=value>', 'Set a config value')
    .description('View or modify agent configuration')
    .action((cmdOpts: { show?: boolean; set?: string }) => {
      const opts = program.opts();
      const config = loadAgentConfig(opts.file);

      if (cmdOpts.set) {
        const [key, ...rest] = cmdOpts.set.split('=');
        const value = rest.join('=');
        const configRecord = config as unknown as Record<string, unknown>;
        if (key in config) {
          const current = configRecord[key];
          if (typeof current === 'number') {
            configRecord[key] = parseFloat(value);
          } else if (Array.isArray(current)) {
            configRecord[key] = value.split(',').map((s) => s.trim());
          } else {
            configRecord[key] = value;
          }
          saveAgentConfig(opts.file, config);
        }
      }

      console.log(formatOutput(config, opts.format as OutputFormat));
    });

  const discovery = agent.command('discovery').description('Discovery registry operations');

  discovery
    .command('status')
    .option('--date <date>', 'Summarize discovery activity for YYYY-MM-DD')
    .description('Show discovery registry summary')
    .action((cmdOpts: { date?: string }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const summary = summarizeDiscovery(baseDir, cmdOpts.date);
      const dates = listDiscoveryDates(baseDir);
      console.log(formatOutput({
        ...summary,
        availableDates: dates,
      }, opts.format as OutputFormat));
    });

  discovery
    .command('list')
    .option('--date <date>', 'Filter by date YYYY-MM-DD')
    .option('--status <status>', 'Filter by status (queued|parsed|imported-draft|duplicate|rejected|deferred)')
    .option('--query <query>', 'Filter by query or title substring')
    .option('--api <api>', 'Filter by source API')
    .option('--run-id <id>', 'Filter by discovery run ID')
    .description('List latest discovery candidates with optional filters')
    .action((cmdOpts: { date?: string; status?: string; query?: string; api?: string; runId?: string }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const candidates = listDiscoveryCandidates(baseDir, {
        date: cmdOpts.date,
        status: cmdOpts.status as 'queued' | 'parsed' | 'imported-draft' | 'duplicate' | 'rejected' | 'deferred' | undefined,
        query: cmdOpts.query,
        api: cmdOpts.api as 'semantic-scholar' | 'openalex' | 'crossref' | 'arxiv' | undefined,
        runId: cmdOpts.runId,
      });
      console.log(formatOutput(candidates, opts.format as OutputFormat));
    });

  discovery
    .command('retry')
    .argument('<candidate-id>', 'Candidate ID to re-queue')
    .option('--run-id <id>', 'Run ID to record for retry')
    .description('Re-queue a discovery candidate for processing')
    .action((candidateId: string, cmdOpts: { runId?: string }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const runId = cmdOpts.runId || `manual-retry-${Date.now()}`;
      const event = retryDiscoveryCandidate(baseDir, candidateId, runId);
      if (!event) {
        console.error(`Discovery candidate ${candidateId} not found`);
        process.exit(1);
      }
      console.log(formatOutput({ status: 'ok', candidate: event }, opts.format as OutputFormat));
    });

  discovery
    .command('ingest')
    .option('--query <queries...>', 'One or more explicit discovery queries')
    .option('--api <apis...>', 'APIs to use (semantic-scholar|openalex)')
    .option('--limit <n>', 'Max results per query/API')
    .option('--max-queries <n>', 'Maximum query count for this run')
    .option('--year-min <year>', 'Minimum publication year')
    .option('--year-max <year>', 'Maximum publication year')
    .option('--run-id <id>', 'Run ID for provenance')
    .option('--auto-import', 'Automatically import queued candidates from this run as draft references')
    .option('--import-limit <n>', 'Maximum queued candidates to import when --auto-import is set')
    .option('--import-review-status <status>', 'Review status for auto-imported references', 'draft')
    .option('--scope-keyword <keywords...>', 'Include keywords for auto-import scope matching')
    .option('--exclude-keyword <keywords...>', 'Exclude keywords for auto-import scope matching')
    .option('--min-scope-score <n>', 'Minimum scope score required for auto-import', '2')
    .option('--no-scope-filter', 'Disable scope filtering for auto-import')
    .option('--auto-node-growth', 'Automatically create new nodes from imported discovery candidates')
    .option('--max-new-nodes <n>', 'Maximum new nodes to create in this import')
    .option('--min-node-confidence <n>', 'Minimum confidence (0-1) required for node creation')
    .option('--node-review-status <status>', 'Review status for auto-created nodes', 'approved')
    .option('--node-similarity-threshold <n>', 'Duplicate similarity threshold (0-1) for node creation')
    .description('Run discovery ingestion and append candidates to discovery registry')
    .action(async (cmdOpts: {
      query?: string[];
      api?: string[];
      limit?: string;
      maxQueries?: string;
      yearMin?: string;
      yearMax?: string;
      runId?: string;
      autoImport?: boolean;
      importLimit?: string;
      importReviewStatus?: string;
      scopeKeyword?: string[];
      excludeKeyword?: string[];
      minScopeScore?: string;
      scopeFilter?: boolean;
      autoNodeGrowth?: boolean;
      maxNewNodes?: string;
      minNodeConfidence?: string;
      nodeReviewStatus?: string;
      nodeSimilarityThreshold?: string;
    }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const state = loadAgentState(opts.file);
      const config = loadAgentConfig(opts.file);

      const result = await runDiscoveryIngestion({
        baseDir,
        data,
        references: data.references,
        config,
        state,
        searchFn: searchLiterature,
        citationFn: async (doi, direction, limit) => {
          const resolved = await resolveDoi(doi);
          if (!resolved?.semanticScholarId) return [];
          return getCitations(resolved.semanticScholarId, direction, limit);
        },
        runId: cmdOpts.runId,
        queries: cmdOpts.query,
        apis: cmdOpts.api as ApiSource[] | undefined,
        limit: cmdOpts.limit ? parseInt(cmdOpts.limit, 10) : undefined,
        maxQueries: cmdOpts.maxQueries ? parseInt(cmdOpts.maxQueries, 10) : undefined,
        yearMin: cmdOpts.yearMin ? parseInt(cmdOpts.yearMin, 10) : undefined,
        yearMax: cmdOpts.yearMax ? parseInt(cmdOpts.yearMax, 10) : undefined,
      });

      let autoImportSummary: ReturnType<typeof importQueuedDiscoveryCandidates> | null = null;
      if (cmdOpts.autoImport) {
        const governanceConfig = loadGovernanceConfig(opts.file);
        const todayAudit = readTodayAuditEntries(baseDir);
        const maxItems = cmdOpts.importLimit ? parseInt(cmdOpts.importLimit, 10) : config.maxNewRefsPerRun;
        const reviewStatus = (cmdOpts.importReviewStatus ?? config.defaultReviewStatus) as ReviewStatus;
        const scopeKeywords = uniqStrings([...(config.focusKeywords ?? []), ...(cmdOpts.scopeKeyword ?? [])]);
        const excludeKeywords = uniqStrings([...(config.excludeKeywords ?? []), ...(cmdOpts.excludeKeyword ?? [])]);
        const minScopeScore = cmdOpts.minScopeScore ? parseInt(cmdOpts.minScopeScore, 10) : 2;
        const maxNewNodes = cmdOpts.maxNewNodes ? parseInt(cmdOpts.maxNewNodes, 10) : config.maxNewNodesPerRun;
        const minNodeConfidence = cmdOpts.minNodeConfidence
          ? parseFloat(cmdOpts.minNodeConfidence)
          : config.minNodeProposalConfidence;
        const nodeSimilarityThreshold = cmdOpts.nodeSimilarityThreshold
          ? parseFloat(cmdOpts.nodeSimilarityThreshold)
          : undefined;
        autoImportSummary = importQueuedDiscoveryCandidates({
          baseDir,
          data,
          governanceConfig,
          auditEntries: todayAudit,
          runId: result.runId,
          sourceRunId: result.runId,
          maxItems,
          reviewStatus,
          scopeKeywords,
          excludeKeywords,
          minScopeScore,
          enforceScopeFilter: cmdOpts.scopeFilter !== false,
          autoNodeGrowth: cmdOpts.autoNodeGrowth === true,
          maxNewNodes,
          minNodeConfidence,
          nodeReviewStatus: (cmdOpts.nodeReviewStatus ?? 'approved') as ReviewStatus,
          nodeSimilarityThreshold,
        });
        if (autoImportSummary.imported > 0) {
          writeFileSync(opts.file, graphToJson(data));
        }
      }

      const derivedState = deriveStateFromDiscovery(baseDir);
      const nextState = {
        ...result.nextState,
        processedCandidateIds: derivedState.processedCandidateIds,
        discoveryStats: derivedState.discoveryStats,
      };
      saveAgentState(opts.file, nextState);

      console.log(formatOutput({
        status: 'ok',
        runId: result.runId,
        queries: result.queries,
        apis: result.apis,
        totalResults: result.totalResults,
        citationAnchorCount: result.citationAnchorCount,
        citationResults: result.citationResults,
        eventsWritten: result.eventsWritten,
        byDecision: result.byDecision,
        autoImport: autoImportSummary,
      }, opts.format as OutputFormat));
    });

  discovery
    .command('import')
    .option('--date <date>', 'Filter queued candidates by discovery date YYYY-MM-DD')
    .option('--run-id <id>', 'Filter queued candidates by source run ID')
    .option('--limit <n>', 'Maximum queued candidates to import')
    .option('--review-status <status>', 'Review status for imported references', 'draft')
    .option('--max-linked-nodes <n>', 'Maximum existing nodes to link per imported reference', '2')
    .option('--scope-keyword <keywords...>', 'Include keywords for auto-import scope matching')
    .option('--exclude-keyword <keywords...>', 'Exclude keywords for auto-import scope matching')
    .option('--min-scope-score <n>', 'Minimum scope score required for import', '2')
    .option('--no-scope-filter', 'Disable scope filtering for import')
    .option('--auto-node-growth', 'Automatically create new nodes from imported candidates')
    .option('--max-new-nodes <n>', 'Maximum new nodes to create in this import')
    .option('--min-node-confidence <n>', 'Minimum confidence (0-1) required for node creation')
    .option('--node-review-status <status>', 'Review status for auto-created nodes', 'approved')
    .option('--node-similarity-threshold <n>', 'Duplicate similarity threshold (0-1) for node creation')
    .description('Import queued discovery candidates into draft references')
    .action((cmdOpts: {
      date?: string;
      runId?: string;
      limit?: string;
      reviewStatus?: string;
      maxLinkedNodes?: string;
      scopeKeyword?: string[];
      excludeKeyword?: string[];
      minScopeScore?: string;
      scopeFilter?: boolean;
      autoNodeGrowth?: boolean;
      maxNewNodes?: string;
      minNodeConfidence?: string;
      nodeReviewStatus?: string;
      nodeSimilarityThreshold?: string;
    }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const config = loadAgentConfig(opts.file);
      const governanceConfig = loadGovernanceConfig(opts.file);
      const state = loadAgentState(opts.file);

      const maxItems = cmdOpts.limit ? parseInt(cmdOpts.limit, 10) : config.maxNewRefsPerRun;
      const maxLinkedNodes = cmdOpts.maxLinkedNodes ? parseInt(cmdOpts.maxLinkedNodes, 10) : 2;
      const reviewStatus = (cmdOpts.reviewStatus ?? config.defaultReviewStatus) as ReviewStatus;
      const scopeKeywords = uniqStrings([...(config.focusKeywords ?? []), ...(cmdOpts.scopeKeyword ?? [])]);
      const excludeKeywords = uniqStrings([...(config.excludeKeywords ?? []), ...(cmdOpts.excludeKeyword ?? [])]);
      const minScopeScore = cmdOpts.minScopeScore ? parseInt(cmdOpts.minScopeScore, 10) : 2;
      const maxNewNodes = cmdOpts.maxNewNodes ? parseInt(cmdOpts.maxNewNodes, 10) : config.maxNewNodesPerRun;
      const minNodeConfidence = cmdOpts.minNodeConfidence
        ? parseFloat(cmdOpts.minNodeConfidence)
        : config.minNodeProposalConfidence;
      const nodeSimilarityThreshold = cmdOpts.nodeSimilarityThreshold
        ? parseFloat(cmdOpts.nodeSimilarityThreshold)
        : undefined;
      const runId = `discovery-import-${Date.now()}`;
      const summary = importQueuedDiscoveryCandidates({
        baseDir,
        data,
        governanceConfig,
        auditEntries: readTodayAuditEntries(baseDir),
        runId,
        sourceRunId: cmdOpts.runId,
        date: cmdOpts.date,
        maxItems,
        maxLinkedNodes,
        reviewStatus,
        scopeKeywords,
        excludeKeywords,
        minScopeScore,
        enforceScopeFilter: cmdOpts.scopeFilter !== false,
        autoNodeGrowth: cmdOpts.autoNodeGrowth === true,
        maxNewNodes,
        minNodeConfidence,
        nodeReviewStatus: (cmdOpts.nodeReviewStatus ?? 'approved') as ReviewStatus,
        nodeSimilarityThreshold,
      });

      if (summary.imported > 0) {
        writeFileSync(opts.file, graphToJson(data));
      }

      const derivedState = deriveStateFromDiscovery(baseDir);
      saveAgentState(opts.file, {
        ...state,
        processedCandidateIds: derivedState.processedCandidateIds,
        discoveryStats: derivedState.discoveryStats,
        lastRunTimestamp: new Date().toISOString(),
        lastRunId: runId,
        totalRuns: (state.totalRuns ?? 0) + 1,
      });

      console.log(formatOutput({
        status: 'ok',
        runId,
        summary,
      }, opts.format as OutputFormat));
    });

  discovery
    .command('reconcile-state')
    .description('Rebuild processed candidate IDs and discovery stats from the discovery registry')
    .action(() => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const state = loadAgentState(opts.file);
      const derived = deriveStateFromDiscovery(baseDir);
      const nextState = {
        ...state,
        processedCandidateIds: derived.processedCandidateIds,
        discoveryStats: derived.discoveryStats,
      };
      saveAgentState(opts.file, nextState);
      console.log(formatOutput({
        status: 'ok',
        totalCandidates: derived.totalCandidates,
        totalEvents: derived.totalEvents,
        processedCandidateIds: derived.processedCandidateIds.length,
        discoveryStats: derived.discoveryStats,
      }, opts.format as OutputFormat));
    });

  const claims = agent.command('claims').description('Claim extraction and claim-level utilities');

  claims
    .command('extract')
    .option('--ref-id <id>', 'Extract claims for a specific reference')
    .option('--force', 'Re-extract even when abstract checksum is unchanged')
    .description('Extract claim-level entries from reference abstracts')
    .action((cmdOpts: { refId?: string; force?: boolean }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const targets = cmdOpts.refId
        ? data.references.filter((r) => r.id === cmdOpts.refId)
        : data.references;

      if (cmdOpts.refId && targets.length === 0) {
        console.error(`Reference ${cmdOpts.refId} not found`);
        process.exit(1);
      }

      let updated = 0;
      let skipped = 0;
      let noAbstract = 0;
      const details: Array<{ refId: string; updated: boolean; reason: string; claimsCount: number }> = [];

      for (const ref of targets) {
        const result = extractClaimsForReference(ref, { force: !!cmdOpts.force });
        if (result.updated) updated++;
        else skipped++;
        if (result.reason === 'no-abstract') noAbstract++;
        details.push({
          refId: ref.id,
          updated: result.updated,
          reason: result.reason,
          claimsCount: result.claimsCount,
        });
      }

      if (updated > 0) {
        writeFileSync(opts.file, graphToJson(data));
      }

      console.log(formatOutput({
        status: 'ok',
        totalReferences: targets.length,
        updated,
        skipped,
        noAbstract,
        force: !!cmdOpts.force,
        details,
      }, opts.format as OutputFormat));
    });

  const runNote = agent.command('run-note').description('Generate and manage agent run notes');

  runNote
    .command('generate')
    .requiredOption('--path <vault>', 'Vault path')
    .option('--run-id <id>', 'Run ID for note filename/title')
    .option('--date <date>', 'Date for note (YYYY-MM-DD)')
    .description('Generate a structured run note in vault/agent-runs')
    .action((cmdOpts: { path: string; runId?: string; date?: string }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const state = loadAgentState(opts.file);

      const date = cmdOpts.date ?? new Date().toISOString().slice(0, 10);
      const runId = cmdOpts.runId
        ?? state.lastDiscoveryRunId
        ?? state.lastRunId
        ?? `manual-${Date.now()}`;
      const discoverySummary = summarizeDiscovery(baseDir, date);
      const rejectedNearMisses = listDiscoveryCandidates(baseDir, {
        date,
        status: 'rejected',
      }).slice(0, 10).map((r) => ({
        candidateId: r.candidateId,
        reason: r.decisionReason,
        title: r.title,
      }));

      const importedDraftRefs = data.references.filter(
        (r) => r.processingStatus === 'imported-draft' || r.reviewStatus === 'draft',
      ).length;
      const topHypotheses = [...data.hypotheses]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((h) => ({ id: h.id, statement: h.statement, score: h.score, status: h.status }));

      const note = writeRunNote(cmdOpts.path, {
        runId,
        date,
        queries: state.recentSearchQueries.slice(-10),
        discoverySummary,
        importedDraftRefs,
        topHypotheses,
        rejectedNearMisses,
      });

      console.log(formatOutput({
        status: 'ok',
        file: note.filePath,
        runId,
        date,
        queryCount: state.recentSearchQueries.slice(-10).length,
      }, opts.format as OutputFormat));
    });

  agent
    .command('contradictions')
    .option('--node <id>', 'Filter to a specific node ID')
    .option('--hypothesis <id>', 'Filter to a specific hypothesis ID')
    .description('Surface mixed support/contradiction evidence from claims and hypothesis links')
    .action((cmdOpts: { node?: string; hypothesis?: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      let nodeSummary = summarizeNodeContradictions(data);
      let hypothesisSummary = summarizeHypothesisContradictions(data.hypotheses);

      if (cmdOpts.node) {
        nodeSummary = nodeSummary.filter((n) => n.nodeId === cmdOpts.node);
      } else {
        nodeSummary = nodeSummary.filter((n) => n.status === 'mixed');
      }

      if (cmdOpts.hypothesis) {
        hypothesisSummary = hypothesisSummary.filter((h) => h.hypothesisId === cmdOpts.hypothesis);
      } else {
        hypothesisSummary = hypothesisSummary.filter((h) => h.status === 'mixed');
      }

      console.log(formatOutput({
        nodeContradictions: nodeSummary,
        hypothesisContradictions: hypothesisSummary,
        summary: {
          mixedNodes: nodeSummary.length,
          mixedHypotheses: hypothesisSummary.length,
        },
      }, opts.format as OutputFormat));
    });

  agent
    .command('metrics')
    .option('--period <period>', 'daily|weekly|monthly', 'weekly')
    .option('--now <iso>', 'Override current timestamp for reproducible reporting')
    .description('Generate calibration metrics report for daily/weekly/monthly loop')
    .action((cmdOpts: { period?: string; now?: string }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const period = (cmdOpts.period as MetricsPeriod) ?? 'weekly';
      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        console.error(`Invalid period: ${period}`);
        process.exit(1);
      }
      const events = readDiscoveryEvents(baseDir);
      const report = buildMetricsReport(data, events, period, cmdOpts.now);
      console.log(formatOutput(report, opts.format as OutputFormat));
    });
}
