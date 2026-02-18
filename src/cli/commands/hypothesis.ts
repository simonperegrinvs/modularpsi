import { Command } from 'commander';
import { readFileSync } from 'fs';
import { propagateTrust } from '../../domain/trust';
import { jsonToGraph } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';
import { rankHypotheses } from '../evidence';

export function registerHypothesisCommands(program: Command) {
  const hypothesis = program.command('hypothesis').description('Hypothesis ranking and analysis');

  hypothesis
    .command('rank')
    .option('--top <n>', 'Show top N hypotheses', '15')
    .option('--include-unreferenced', 'Include nodes with no linked references', false)
    .option('--include-root', 'Include root node in ranking', false)
    .description('Rank hypotheses using propagated trust and evidence quality')
    .action((cmdOpts: { top: string; includeUnreferenced: boolean; includeRoot: boolean }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      const top = Number.parseInt(cmdOpts.top, 10);
      const ranked = rankHypotheses(data, {
        includeUnreferenced: cmdOpts.includeUnreferenced,
        includeRoot: cmdOpts.includeRoot,
      }).slice(0, Number.isFinite(top) && top > 0 ? top : 15);

      const rows = ranked.map((item) => ({
        id: item.id,
        name: item.name,
        trust: item.trust,
        evidenceCount: item.evidenceCount,
        evidenceScore: item.evidenceScore,
        rankScore: item.rankScore,
        supports: item.supportCount,
        mixed: item.mixedCount,
        null: item.nullCount,
        challenges: item.challengeCount,
      }));

      console.log(formatOutput(rows, opts.format as OutputFormat));
    });
}

