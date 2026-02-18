import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import type { GraphData } from '../../domain/types';
import { propagateTrust } from '../../domain/trust';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

function loadGraph(file: string): GraphData {
  return jsonToGraph(readFileSync(file, 'utf-8'));
}

function saveGraph(file: string, data: GraphData) {
  writeFileSync(file, graphToJson(data));
}

export function registerTrustCommands(program: Command) {
  const trust = program.command('trust').description('Trust propagation operations');

  trust
    .command('show')
    .option('--node <id>', 'Show trust for a specific node')
    .description('Show trust values (auto-propagates first)')
    .action((cmdOpts: { node?: string }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);

      // Re-propagate
      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);

      if (cmdOpts.node) {
        const node = propagated.nodes.find((n) => n.id === cmdOpts.node);
        if (!node) {
          console.error(`Node ${cmdOpts.node} not found`);
          process.exit(1);
        }
        const inEdges = propagated.edges
          .filter((e) => e.targetId === cmdOpts.node)
          .map((e) => ({ from: e.sourceId, edgeTrust: e.trust, combinedTrust: e.combinedTrust }));
        console.log(formatOutput({ id: node.id, name: node.name, trust: node.trust, incomingEdges: inEdges }, opts.format as OutputFormat));
      } else {
        const rows = propagated.nodes.map((n) => ({
          id: n.id,
          name: n.name,
          trust: n.trust,
        }));
        console.log(formatOutput(rows, opts.format as OutputFormat));
      }
    });

  trust
    .command('propagate')
    .description('Re-propagate trust values and save')
    .action(() => {
      const opts = program.opts();
      const data = loadGraph(opts.file);

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      saveGraph(opts.file, data);
      console.log(formatOutput({ status: 'ok', nodesUpdated: data.nodes.length }, opts.format as OutputFormat));
    });
}
