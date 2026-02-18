import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

export function registerRefCommands(program: Command) {
  const ref = program.command('ref').description('Manage references');

  ref
    .command('list')
    .option('--node <id>', 'Filter by node ID')
    .description('List references')
    .action((cmdOpts: { node?: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      if (cmdOpts.node) {
        const node = data.nodes.find((n) => n.id === cmdOpts.node);
        if (!node) {
          console.error(`Node ${cmdOpts.node} not found`);
          process.exit(1);
        }
        const nodeRefs = data.references.filter((r) => node.referenceIds.includes(r.id));
        console.log(formatOutput(nodeRefs, opts.format as OutputFormat));
      } else {
        console.log(formatOutput(data.references, opts.format as OutputFormat));
      }
    });

  ref
    .command('add')
    .requiredOption('--title <title>', 'Reference title')
    .option('--authors <authors>', 'Authors (semicolon-separated)', '')
    .option('--year <year>', 'Publication year', '0')
    .description('Add a reference')
    .action((cmdOpts: { title: string; authors: string; year: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const id = `ref-${Date.now()}`;
      const newRef = {
        id,
        title: cmdOpts.title,
        authors: cmdOpts.authors ? cmdOpts.authors.split(';').map((a) => a.trim()).filter(Boolean) : [],
        year: parseInt(cmdOpts.year) || 0,
        publication: '',
        publisher: '',
        citation: '',
        pageStart: 0,
        pageEnd: 0,
        volume: 0,
      };
      data.references.push(newRef);

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput(newRef, opts.format as OutputFormat));
    });

  ref
    .command('link')
    .argument('<ref-id>', 'Reference ID')
    .argument('<node-id>', 'Node ID')
    .description('Link a reference to a node')
    .action((refId: string, nodeId: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const node = data.nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(`Node ${nodeId} not found`);
        process.exit(1);
      }

      if (!node.referenceIds.includes(refId)) {
        node.referenceIds.push(refId);
      }

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput({ linked: refId, to: nodeId }, opts.format as OutputFormat));
    });

  ref
    .command('unlink')
    .argument('<ref-id>', 'Reference ID')
    .argument('<node-id>', 'Node ID')
    .description('Unlink a reference from a node')
    .action((refId: string, nodeId: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const node = data.nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(`Node ${nodeId} not found`);
        process.exit(1);
      }

      node.referenceIds = node.referenceIds.filter((r) => r !== refId);

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput({ unlinked: refId, from: nodeId }, opts.format as OutputFormat));
    });
}
