import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import type { GraphData, GraphNode } from '../../domain/types';
import { nodeTypeLabel, parseNodeType, EDGE_TYPE_IMPLICATION } from '../../domain/types';
import { propagateTrust } from '../../domain/trust';
import { canDeleteNode } from '../../domain/validation';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

function loadGraph(file: string): GraphData {
  return jsonToGraph(readFileSync(file, 'utf-8'));
}

function saveGraph(file: string, data: GraphData) {
  writeFileSync(file, graphToJson(data));
}

export function registerNodeCommands(program: Command) {
  const node = program.command('node').description('Manage graph nodes');

  node
    .command('list')
    .description('List all nodes')
    .action(() => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const rows = data.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        trust: n.trust,
        type: nodeTypeLabel[n.type],
        category: n.categoryId,
      }));
      console.log(formatOutput(rows, opts.format as OutputFormat));
    });

  node
    .command('show')
    .argument('<id>', 'Node ID')
    .description('Show full node details')
    .action((id: string) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const n = data.nodes.find((n) => n.id === id);
      if (!n) {
        console.error(`Node ${id} not found`);
        process.exit(1);
      }
      const outEdges = data.edges
        .filter((e) => e.sourceId === id)
        .map((e) => ({ id: e.id, targetId: e.targetId, trust: e.trust, type: e.type }));
      const result = { ...n, edges: outEdges };
      console.log(formatOutput(result, opts.format as OutputFormat));
    });

  node
    .command('add')
    .requiredOption('--parent <id>', 'Parent node ID')
    .requiredOption('--name <name>', 'Node name')
    .option('--type <type>', 'Node type (regular|chooser|holder)', 'regular')
    .option('--category <cat>', 'Category ID', 'general')
    .option('--description <desc>', 'Node description', '')
    .option('--require-description', 'Require a non-empty description', false)
    .description('Add a new node')
    .action((cmdOpts: { parent: string; name: string; type: string; category: string; description: string; requireDescription: boolean }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const parent = data.nodes.find((n) => n.id === cmdOpts.parent);
      if (!parent) {
        console.error(`Parent node ${cmdOpts.parent} not found`);
        process.exit(1);
      }
      if (cmdOpts.requireDescription && cmdOpts.description.trim() === '') {
        console.error('Description is required (--description) when --require-description is enabled.');
        process.exit(1);
      }

      const nextNum = data.lastNodeNumber + 1;
      const newId = `${data.prefix}${nextNum}`;
      const nodeType = parseNodeType(cmdOpts.type);

      const newNode: GraphNode = {
        id: newId,
        name: cmdOpts.name,
        description: cmdOpts.description.trim(),
        categoryId: cmdOpts.category,
        keywords: [],
        type: nodeType,
        trust: -1,
        referenceIds: [],
      };

      data.nodes.push(newNode);
      data.edges.push({
        id: `${cmdOpts.parent}-${newId}`,
        sourceId: cmdOpts.parent,
        targetId: newId,
        trust: -1,
        type: EDGE_TYPE_IMPLICATION,
        combinedTrust: -1,
      });
      data.lastNodeNumber = nextNum;

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      saveGraph(opts.file, data);
      console.log(formatOutput({ id: newId, name: cmdOpts.name }, opts.format as OutputFormat));
    });

  node
    .command('update')
    .argument('<id>', 'Node ID')
    .option('--name <name>', 'New name')
    .option('--description <desc>', 'New description')
    .option('--description-file <path>', 'Path to file containing description text')
    .option('--category <cat>', 'New category ID')
    .option('--keywords <keywords>', 'New keywords (semicolon-separated)')
    .option('--type <type>', 'New type (regular|chooser|holder)')
    .description('Update a node')
    .action((id: string, cmdOpts: { name?: string; description?: string; descriptionFile?: string; category?: string; keywords?: string; type?: string }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const node = data.nodes.find((n) => n.id === id);
      if (!node) {
        console.error(`Node ${id} not found`);
        process.exit(1);
      }

      if (cmdOpts.name !== undefined) node.name = cmdOpts.name;
      if (cmdOpts.descriptionFile !== undefined) {
        node.description = readFileSync(cmdOpts.descriptionFile, 'utf-8').trim();
      } else if (cmdOpts.description !== undefined) {
        node.description = cmdOpts.description;
      }
      if (cmdOpts.category !== undefined) node.categoryId = cmdOpts.category;
      if (cmdOpts.keywords !== undefined) node.keywords = cmdOpts.keywords.split(';').map((k) => k.trim()).filter(Boolean);
      if (cmdOpts.type !== undefined) node.type = parseNodeType(cmdOpts.type);

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      saveGraph(opts.file, data);
      console.log(formatOutput(node, opts.format as OutputFormat));
    });

  node
    .command('delete')
    .argument('<id>', 'Node ID')
    .description('Delete a leaf node')
    .action((id: string) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const check = canDeleteNode(id, data.edges);
      if (!check.ok) {
        console.error(check.reason);
        process.exit(1);
      }

      data.nodes = data.nodes.filter((n) => n.id !== id);
      data.edges = data.edges.filter((e) => e.sourceId !== id && e.targetId !== id);

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      saveGraph(opts.file, data);
      console.log(formatOutput({ deleted: id }, opts.format as OutputFormat));
    });
}
