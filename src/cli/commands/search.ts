import { Command } from 'commander';
import { readFileSync } from 'fs';
import { jsonToGraph } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

export function registerSearchCommands(program: Command) {
  program
    .command('search')
    .argument('<query>', 'Search query')
    .description('Search nodes by name, description, or keywords')
    .action((query: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const q = query.toLowerCase();

      const results = data.nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.keywords.some((k) => k.toLowerCase().includes(q)),
      );

      const rows = results.map((n) => ({
        id: n.id,
        name: n.name,
        trust: n.trust,
        category: n.categoryId,
      }));

      console.log(formatOutput(rows, opts.format as OutputFormat));
    });
}
