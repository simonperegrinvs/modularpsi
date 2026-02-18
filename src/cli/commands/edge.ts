import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import type { GraphData } from '../../domain/types';
import { edgeTypeLabel, parseEdgeType } from '../../domain/types';
import { propagateTrust } from '../../domain/trust';
import { canDeleteEdge, canAddEdge } from '../../domain/validation';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

function loadGraph(file: string): GraphData {
  return jsonToGraph(readFileSync(file, 'utf-8'));
}

function saveGraph(file: string, data: GraphData) {
  writeFileSync(file, graphToJson(data));
}

export function registerEdgeCommands(program: Command) {
  const edge = program.command('edge').description('Manage graph edges');

  edge
    .command('list')
    .option('--node <id>', 'Filter by node ID')
    .description('List all edges')
    .action((cmdOpts: { node?: string }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      let edges = data.edges;
      if (cmdOpts.node) {
        edges = edges.filter((e) => e.sourceId === cmdOpts.node || e.targetId === cmdOpts.node);
      }
      const rows = edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        trust: e.trust,
        type: edgeTypeLabel[e.type],
        combinedTrust: e.combinedTrust,
      }));
      console.log(formatOutput(rows, opts.format as OutputFormat));
    });

  edge
    .command('add')
    .requiredOption('--source <id>', 'Source node ID')
    .requiredOption('--target <id>', 'Target node ID')
    .option('--trust <trust>', 'Trust value (-1 to 1)', '-1')
    .option('--type <type>', 'Edge type (implication|derivation|possibility)', 'implication')
    .description('Add a new edge')
    .action((cmdOpts: { source: string; target: string; trust: string; type: string }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);

      const check = canAddEdge(cmdOpts.source, cmdOpts.target, data.edges);
      if (!check.ok) {
        console.error(check.reason);
        process.exit(1);
      }

      if (!data.nodes.find((n) => n.id === cmdOpts.source)) {
        console.error(`Source node ${cmdOpts.source} not found`);
        process.exit(1);
      }
      if (!data.nodes.find((n) => n.id === cmdOpts.target)) {
        console.error(`Target node ${cmdOpts.target} not found`);
        process.exit(1);
      }

      const edgeId = `${cmdOpts.source}-${cmdOpts.target}`;
      data.edges.push({
        id: edgeId,
        sourceId: cmdOpts.source,
        targetId: cmdOpts.target,
        trust: parseFloat(cmdOpts.trust),
        type: parseEdgeType(cmdOpts.type),
        combinedTrust: -1,
      });

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      saveGraph(opts.file, data);
      console.log(formatOutput({ id: edgeId }, opts.format as OutputFormat));
    });

  edge
    .command('update')
    .argument('<id>', 'Edge ID')
    .option('--trust <trust>', 'New trust value')
    .option('--type <type>', 'New edge type')
    .description('Update an edge')
    .action((id: string, cmdOpts: { trust?: string; type?: string }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const edge = data.edges.find((e) => e.id === id);
      if (!edge) {
        console.error(`Edge ${id} not found`);
        process.exit(1);
      }

      if (cmdOpts.trust !== undefined) edge.trust = parseFloat(cmdOpts.trust);
      if (cmdOpts.type !== undefined) edge.type = parseEdgeType(cmdOpts.type);

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      saveGraph(opts.file, data);
      const updated = data.edges.find((e) => e.id === id);
      console.log(formatOutput(updated, opts.format as OutputFormat));
    });

  edge
    .command('delete')
    .argument('<id>', 'Edge ID')
    .description('Delete an edge')
    .action((id: string) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);

      const check = canDeleteEdge(id, data.edges);
      if (!check.ok) {
        console.error(check.reason);
        process.exit(1);
      }

      data.edges = data.edges.filter((e) => e.id !== id);

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      saveGraph(opts.file, data);
      console.log(formatOutput({ deleted: id }, opts.format as OutputFormat));
    });
}
