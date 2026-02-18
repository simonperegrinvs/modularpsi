import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { searchLiterature, resolveDoi, getCitations } from '../../agent/search/index';
import type { ApiSource } from '../../agent/search/index';
import { graphToJson, jsonToGraph } from '../../io/json-io';
import {
  enrichReference,
  enrichReferences,
  hasReferenceLocator,
  type TitleSearchApi,
} from '../../agent/reference-enrichment';
import { formatOutput, type OutputFormat } from '../format';

export function registerLiteratureCommands(program: Command) {
  const lit = program.command('literature').description('Search external literature databases');

  function parseTitleApis(input?: string[]): TitleSearchApi[] {
    if (!input || input.length === 0) return ['semantic-scholar', 'openalex'];
    const allowed = new Set<TitleSearchApi>(['semantic-scholar', 'openalex']);
    const invalid = input.filter((api) => !allowed.has(api as TitleSearchApi));
    if (invalid.length > 0) {
      throw new Error(`Invalid --api value(s): ${invalid.join(', ')}. Allowed: semantic-scholar, openalex`);
    }
    return [...new Set(input as TitleSearchApi[])];
  }

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
    .option('--ref-id <id>', 'Reference ID to enrich')
    .option('--all', 'Enrich multiple references in one pass')
    .option('--include-complete', 'With --all, include references that already have DOI/URL')
    .option('--api <apis...>', 'APIs to use for title search (semantic-scholar|openalex)')
    .option('--limit <n>', 'Max title-search results per API', '5')
    .description('Enrich references with DOI/URL/external IDs/abstract using external APIs')
    .action(async (cmdOpts: {
      refId?: string;
      all?: boolean;
      includeComplete?: boolean;
      api?: string[];
      limit?: string;
    }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      if (!cmdOpts.refId && !cmdOpts.all) {
        console.error('Specify either --ref-id <id> or --all');
        process.exit(1);
      }
      if (cmdOpts.refId && cmdOpts.all) {
        console.error('Use either --ref-id or --all, not both');
        process.exit(1);
      }

      let titleApis: TitleSearchApi[];
      try {
        titleApis = parseTitleApis(cmdOpts.api);
      } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
      }

      const limit = cmdOpts.limit ? parseInt(cmdOpts.limit, 10) : 5;
      if (!Number.isFinite(limit) || limit <= 0) {
        console.error('Option --limit must be a positive integer');
        process.exit(1);
      }

      if (cmdOpts.refId) {
        const ref = data.references.find((r) => r.id === cmdOpts.refId);
        if (!ref) {
          console.error(`Reference ${cmdOpts.refId} not found`);
          process.exit(1);
        }

        const result = await enrichReference(
          ref,
          {
            resolveDoi,
            searchByTitle: searchLiterature,
          },
          {
            apis: titleApis,
            limit,
          },
        );

        if (result.status === 'enriched') {
          writeFileSync(opts.file, graphToJson(data));
        }

        console.log(formatOutput(result, opts.format as OutputFormat));
        return;
      }

      const includeComplete = !!cmdOpts.includeComplete;
      const report = await enrichReferences(
        data.references,
        {
          resolveDoi,
          searchByTitle: searchLiterature,
        },
        {
          apis: titleApis,
          limit,
          onlyMissingLocator: !includeComplete,
        },
      );

      if (report.enriched > 0) {
        writeFileSync(opts.file, graphToJson(data));
      }

      console.log(formatOutput({
        ...report,
        skippedComplete: includeComplete
          ? 0
          : data.references.filter((ref) => hasReferenceLocator(ref)).length,
      }, opts.format as OutputFormat));
    });
}
