import { Command } from 'commander';
import { readFileSync } from 'fs';
import { jsonToGraph } from '../../io/json-io';
import { loadAgentState, resetAgentState } from '../../agent/state';
import { loadAgentConfig, saveAgentConfig } from '../../agent/config';
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
        if (key in config) {
          const current = (config as Record<string, unknown>)[key];
          if (typeof current === 'number') {
            (config as Record<string, unknown>)[key] = parseFloat(value);
          } else if (Array.isArray(current)) {
            (config as Record<string, unknown>)[key] = value.split(',').map((s) => s.trim());
          } else {
            (config as Record<string, unknown>)[key] = value;
          }
          saveAgentConfig(opts.file, config);
        }
      }

      console.log(formatOutput(config, opts.format as OutputFormat));
    });
}
