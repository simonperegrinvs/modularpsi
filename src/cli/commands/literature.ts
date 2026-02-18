import { Command } from 'commander';
import { readFileSync } from 'fs';
import { searchLiterature, resolveDoi, getCitations } from '../../agent/search/index';
import type { ApiSource } from '../../agent/search/index';
import { jsonToGraph } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

export function registerLiteratureCommands(program: Command) {
  const lit = program.command('literature').description('Search external literature databases');

  lit
    .command('search')
    .requiredOption('--query <q>', 'Search query')
    .option('--api <api>', 'API source (semantic-scholar|openalex)', 'semantic-scholar')
    .option('--limit <n>', 'Max results', '20')
    .option('--year-min <year>', 'Minimum year')
    .option('--year-max <year>', 'Maximum year')
    .description('Search for papers (read-only, does not modify graph)')
    .action(async (cmdOpts: { query: string; api: string; limit: string; yearMin?: string; yearMax?: string }) => {
      const opts = program.opts();
      try {
        const results = await searchLiterature({
          query: cmdOpts.query,
          api: cmdOpts.api as ApiSource,
          limit: parseInt(cmdOpts.limit),
          yearMin: cmdOpts.yearMin ? parseInt(cmdOpts.yearMin) : undefined,
          yearMax: cmdOpts.yearMax ? parseInt(cmdOpts.yearMax) : undefined,
        });
        console.log(formatOutput(results, opts.format as OutputFormat));
      } catch (err) {
        console.error(`Search failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  lit
    .command('resolve')
    .requiredOption('--doi <doi>', 'DOI to resolve')
    .description('Resolve a DOI to paper metadata')
    .action(async (cmdOpts: { doi: string }) => {
      const opts = program.opts();
      try {
        const result = await resolveDoi(cmdOpts.doi);
        if (!result) {
          console.error('DOI not found');
          process.exit(1);
        }
        console.log(formatOutput(result, opts.format as OutputFormat));
      } catch (err) {
        console.error(`Resolve failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  lit
    .command('citations')
    .requiredOption('--doi <doi>', 'DOI of the paper')
    .option('--direction <dir>', 'citing or cited-by', 'citing')
    .option('--limit <n>', 'Max results', '20')
    .description('Get citations for a paper')
    .action(async (cmdOpts: { doi: string; direction: string; limit: string }) => {
      const opts = program.opts();
      try {
        // First resolve DOI to S2 ID
        const paper = await resolveDoi(cmdOpts.doi);
        if (!paper?.semanticScholarId) {
          console.error('Could not resolve DOI to Semantic Scholar ID');
          process.exit(1);
        }
        const results = await getCitations(
          paper.semanticScholarId,
          cmdOpts.direction as 'citing' | 'cited-by',
          parseInt(cmdOpts.limit),
        );
        console.log(formatOutput(results, opts.format as OutputFormat));
      } catch (err) {
        console.error(`Citations failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  lit
    .command('enrich')
    .requiredOption('--ref-id <id>', 'Reference ID to enrich')
    .description('Enrich an existing reference with external API data')
    .action(async (cmdOpts: { refId: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const ref = data.references.find((r) => r.id === cmdOpts.refId);
      if (!ref) {
        console.error(`Reference ${cmdOpts.refId} not found`);
        process.exit(1);
      }

      const enriched: Record<string, string> = {};

      // Try to resolve by DOI or title search
      if (ref.doi) {
        const result = await resolveDoi(ref.doi);
        if (result) {
          if (!ref.abstract && result.abstract) { ref.abstract = result.abstract; enriched['abstract'] = 'filled'; }
          if (!ref.semanticScholarId && result.semanticScholarId) { ref.semanticScholarId = result.semanticScholarId; enriched['semanticScholarId'] = result.semanticScholarId; }
          if (!ref.url && result.url) { ref.url = result.url; enriched['url'] = result.url; }
        }
      } else if (ref.title) {
        const results = await searchLiterature({ query: ref.title, limit: 3 });
        const match = results.find((r) =>
          r.title.toLowerCase().includes(ref.title.toLowerCase().substring(0, 30)),
        );
        if (match) {
          if (match.doi && !ref.doi) { ref.doi = match.doi; enriched['doi'] = match.doi; }
          if (match.abstract && !ref.abstract) { ref.abstract = match.abstract; enriched['abstract'] = 'filled'; }
          if (match.semanticScholarId && !ref.semanticScholarId) { ref.semanticScholarId = match.semanticScholarId; enriched['semanticScholarId'] = match.semanticScholarId; }
          if (match.url && !ref.url) { ref.url = match.url; enriched['url'] = match.url; }
        }
      }

      if (Object.keys(enriched).length > 0) {
        const { writeFileSync } = await import('fs');
        const { graphToJson } = await import('../../io/json-io');
        writeFileSync(opts.file, graphToJson(data));
      }

      console.log(formatOutput({ refId: cmdOpts.refId, enriched }, opts.format as OutputFormat));
    });
}
