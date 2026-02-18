import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import type { ReviewStatus } from '../../domain/types';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { applyReviewStatusToNode, applyReviewStatusToReference } from '../../domain/review';
import { formatOutput, type OutputFormat } from '../format';

export function registerReviewCommands(program: Command) {
  const review = program.command('review').description('Review workflow for agent-added content');

  review
    .command('list')
    .option('--status <status>', 'Filter by review status (draft|pending-review|approved|rejected)')
    .description('List items with review status')
    .action((cmdOpts: { status?: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const status = cmdOpts.status as ReviewStatus | undefined;

      const nodes = data.nodes
        .filter((n) => n.reviewStatus && (!status || n.reviewStatus === status))
        .map((n) => ({ type: 'node', id: n.id, name: n.name, reviewStatus: n.reviewStatus }));

      const refs = data.references
        .filter((r) => r.reviewStatus && (!status || r.reviewStatus === status))
        .map((r) => ({ type: 'reference', id: r.id, name: r.title, reviewStatus: r.reviewStatus }));

      console.log(formatOutput([...nodes, ...refs], opts.format as OutputFormat));
    });

  review
    .command('pending')
    .description('List items pending review')
    .action(() => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const nodes = data.nodes
        .filter((n) => n.reviewStatus === 'draft' || n.reviewStatus === 'pending-review')
        .map((n) => ({ type: 'node', id: n.id, name: n.name, reviewStatus: n.reviewStatus }));

      const refs = data.references
        .filter((r) => r.reviewStatus === 'draft' || r.reviewStatus === 'pending-review')
        .map((r) => ({ type: 'reference', id: r.id, name: r.title, reviewStatus: r.reviewStatus }));

      console.log(formatOutput([...nodes, ...refs], opts.format as OutputFormat));
    });

  review
    .command('approve')
    .argument('<id>', 'Node or reference ID')
    .description('Approve an item')
    .action((id: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const now = new Date().toISOString();

      const node = data.nodes.find((n) => n.id === id);
      if (node) {
        applyReviewStatusToNode(node, 'approved', now);
        writeFileSync(opts.file, graphToJson(data));
        console.log(formatOutput({ approved: id, type: 'node' }, opts.format as OutputFormat));
        return;
      }

      const ref = data.references.find((r) => r.id === id);
      if (ref) {
        applyReviewStatusToReference(ref, 'approved');
        writeFileSync(opts.file, graphToJson(data));
        console.log(formatOutput({ approved: id, type: 'reference' }, opts.format as OutputFormat));
        return;
      }

      console.error(`Item ${id} not found`);
      process.exit(1);
    });

  review
    .command('reject')
    .argument('<id>', 'Node or reference ID')
    .description('Reject an item')
    .action((id: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const node = data.nodes.find((n) => n.id === id);
      if (node) {
        applyReviewStatusToNode(node, 'rejected', new Date().toISOString());
        writeFileSync(opts.file, graphToJson(data));
        console.log(formatOutput({ rejected: id, type: 'node' }, opts.format as OutputFormat));
        return;
      }

      const ref = data.references.find((r) => r.id === id);
      if (ref) {
        applyReviewStatusToReference(ref, 'rejected');
        writeFileSync(opts.file, graphToJson(data));
        console.log(formatOutput({ rejected: id, type: 'reference' }, opts.format as OutputFormat));
        return;
      }

      console.error(`Item ${id} not found`);
      process.exit(1);
    });
}
