import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import { jsonToGraph } from '../../io/json-io';
import { loadAgentState, resetAgentState } from '../../agent/state';
import { loadAgentConfig, saveAgentConfig } from '../../agent/config';
import {
  listDiscoveryCandidates,
  listDiscoveryDates,
  retryDiscoveryCandidate,
  summarizeDiscovery,
} from '../../agent/discovery';
import { formatOutput, type OutputFormat } from '../format';

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
    .description('List latest discovery candidates with optional filters')
    .action((cmdOpts: { date?: string; status?: string; query?: string; api?: string }) => {
      const opts = program.opts();
      const baseDir = dirname(opts.file);
      const candidates = listDiscoveryCandidates(baseDir, {
        date: cmdOpts.date,
        status: cmdOpts.status as 'queued' | 'parsed' | 'imported-draft' | 'duplicate' | 'rejected' | 'deferred' | undefined,
        query: cmdOpts.query,
        api: cmdOpts.api as 'semantic-scholar' | 'openalex' | 'crossref' | 'arxiv' | undefined,
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
}
