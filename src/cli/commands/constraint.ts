import { Command } from 'commander';
import { readFileSync } from 'fs';
import { isConstraintEdge } from '../../domain/constraints';
import { edgeTypeLabel } from '../../domain/types';
import { jsonToGraph } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

export function registerConstraintCommands(program: Command) {
  const constraint = program.command('constraint').description('Constraint edge diagnostics');

  constraint
    .command('list')
    .option('--node <id>', 'Filter by source or target node ID')
    .description('List constraint edges (requires/confounded-by/incompatible-with/fails-when)')
    .action((cmdOpts: { node?: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const edges = data.edges
        .filter((e) => isConstraintEdge(e))
        .filter((e) => !cmdOpts.node || e.sourceId === cmdOpts.node || e.targetId === cmdOpts.node)
        .map((e) => ({
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          type: edgeTypeLabel[e.type],
          trust: e.trust,
          combinedTrust: e.combinedTrust,
        }));

      console.log(formatOutput(edges, opts.format as OutputFormat));
    });
}
