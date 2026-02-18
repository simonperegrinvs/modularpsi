import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import type { Reference } from '../../domain/types';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

export function registerRefCommands(program: Command) {
  const ref = program.command('ref').description('Manage references');

  ref
    .command('list')
    .option('--node <id>', 'Filter by node ID')
    .option('--review-status <status>', 'Filter by review status')
    .description('List references')
    .action((cmdOpts: { node?: string; reviewStatus?: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      let refs = data.references;

      if (cmdOpts.node) {
        const node = data.nodes.find((n) => n.id === cmdOpts.node);
        if (!node) {
          console.error(`Node ${cmdOpts.node} not found`);
          process.exit(1);
        }
        refs = refs.filter((r) => node.referenceIds.includes(r.id));
      }

      if (cmdOpts.reviewStatus) {
        refs = refs.filter((r) => r.reviewStatus === cmdOpts.reviewStatus);
      }

      console.log(formatOutput(refs, opts.format as OutputFormat));
    });

  ref
    .command('show')
    .argument('<id>', 'Reference ID')
    .description('Show full reference details')
    .action((id: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const r = data.references.find((r) => r.id === id);
      if (!r) {
        console.error(`Reference ${id} not found`);
        process.exit(1);
      }
      const linkedNodes = data.nodes
        .filter((n) => n.referenceIds.includes(id))
        .map((n) => ({ id: n.id, name: n.name }));
      console.log(formatOutput({ ...r, linkedNodes }, opts.format as OutputFormat));
    });

  ref
    .command('add')
    .requiredOption('--title <title>', 'Reference title')
    .option('--authors <authors>', 'Authors (semicolon-separated)', '')
    .option('--year <year>', 'Publication year', '0')
    .option('--description <desc>', 'Brief description')
    .option('--journal <journal>', 'Journal/publication name')
    .option('--citation <citation>', 'Full citation string')
    .option('--doi <doi>', 'DOI identifier')
    .option('--url <url>', 'Direct URL')
    .option('--abstract <abstract>', 'Full abstract text')
    .description('Add a reference')
    .action((cmdOpts: {
      title: string; authors: string; year: string;
      description?: string; journal?: string; citation?: string;
      doi?: string; url?: string; abstract?: string;
    }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const id = `ref-${Date.now()}`;
      const newRef: Reference = {
        id,
        title: cmdOpts.title,
        authors: cmdOpts.authors ? cmdOpts.authors.split(';').map((a) => a.trim()).filter(Boolean) : [],
        year: parseInt(cmdOpts.year) || 0,
        publication: cmdOpts.journal ?? '',
        publisher: '',
        citation: cmdOpts.citation ?? '',
        pageStart: 0,
        pageEnd: 0,
        volume: 0,
        description: cmdOpts.description ?? '',
        doi: cmdOpts.doi ?? '',
        url: cmdOpts.url ?? '',
        semanticScholarId: '',
        openAlexId: '',
        abstract: cmdOpts.abstract ?? '',
      };
      data.references.push(newRef);

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput(newRef, opts.format as OutputFormat));
    });

  ref
    .command('update')
    .argument('<id>', 'Reference ID')
    .option('--title <title>', 'New title')
    .option('--authors <authors>', 'New authors (semicolon-separated)')
    .option('--year <year>', 'New year')
    .option('--description <desc>', 'New description')
    .option('--journal <journal>', 'New journal/publication')
    .option('--citation <citation>', 'New citation string')
    .option('--doi <doi>', 'New DOI')
    .option('--url <url>', 'New URL')
    .option('--abstract <abstract>', 'New abstract')
    .description('Update a reference')
    .action((id: string, cmdOpts: {
      title?: string; authors?: string; year?: string;
      description?: string; journal?: string; citation?: string;
      doi?: string; url?: string; abstract?: string;
    }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const r = data.references.find((r) => r.id === id);
      if (!r) {
        console.error(`Reference ${id} not found`);
        process.exit(1);
      }

      if (cmdOpts.title !== undefined) r.title = cmdOpts.title;
      if (cmdOpts.authors !== undefined) r.authors = cmdOpts.authors.split(';').map((a) => a.trim()).filter(Boolean);
      if (cmdOpts.year !== undefined) r.year = parseInt(cmdOpts.year) || 0;
      if (cmdOpts.description !== undefined) r.description = cmdOpts.description;
      if (cmdOpts.journal !== undefined) r.publication = cmdOpts.journal;
      if (cmdOpts.citation !== undefined) r.citation = cmdOpts.citation;
      if (cmdOpts.doi !== undefined) r.doi = cmdOpts.doi;
      if (cmdOpts.url !== undefined) r.url = cmdOpts.url;
      if (cmdOpts.abstract !== undefined) r.abstract = cmdOpts.abstract;

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput(r, opts.format as OutputFormat));
    });

  ref
    .command('search')
    .argument('<query>', 'Search query')
    .description('Search references by title, author, DOI, or description')
    .action((query: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const q = query.toLowerCase();
      const results = data.references.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.doi.toLowerCase().includes(q) ||
        r.authors.some((a) => a.toLowerCase().includes(q)),
      );
      console.log(formatOutput(results, opts.format as OutputFormat));
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
