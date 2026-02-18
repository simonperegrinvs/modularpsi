import { Command } from 'commander';
import { readFileSync } from 'fs';
import type { Reference } from '../../domain/types';
import { propagateTrust } from '../../domain/trust';
import { jsonToGraph } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';
import { rankHypotheses } from '../evidence';

function summarizeRef(ref: Reference): string {
  const source = ref.abstract?.trim() || ref.citation?.trim() || '';
  if (source.length <= 180) return source;
  return `${source.slice(0, 177)}...`;
}

function refSortValue(ref: Reference): number {
  const quality = ref.qualityScore ?? 0.5;
  const replicationBoost = ref.replicationStatus === 'multi-lab'
    ? 0.2
    : ref.replicationStatus === 'independent-replication'
      ? 0.1
      : ref.replicationStatus === 'failed-replication'
        ? -0.1
        : 0;
  return quality + replicationBoost;
}

function buildMarkdownBrief(
  items: Array<{
    id: string;
    name: string;
    description: string;
    trust: number;
    evidenceCount: number;
    evidenceScore: number;
    rankScore: number;
    references: Reference[];
  }>,
): string {
  const lines: string[] = [];
  lines.push('# Hypothesis Evidence Brief');
  lines.push('');
  for (const item of items) {
    lines.push(`## ${item.id} — ${item.name}`);
    if (item.description.trim() !== '') {
      lines.push(`- Description: ${item.description}`);
    }
    lines.push(`- Trust: ${item.trust.toFixed(2)} | Evidence score: ${item.evidenceScore.toFixed(2)} | Rank score: ${item.rankScore.toFixed(2)} | References: ${item.evidenceCount}`);
    if (item.references.length === 0) {
      lines.push('- No linked references.');
      lines.push('');
      continue;
    }

    for (const ref of item.references) {
      const authors = ref.authors.length > 0 ? ref.authors.join(', ') : 'Unknown authors';
      const studyType = ref.studyType ?? 'unspecified';
      const direction = ref.effectDirection ?? 'unspecified';
      const replication = ref.replicationStatus ?? 'unspecified';
      const url = ref.url ?? (ref.doi ? `https://doi.org/${ref.doi}` : '');
      lines.push(`- **${ref.title}** (${ref.year}) — ${authors}. Type: ${studyType}; Effect: ${direction}; Replication: ${replication}.`);
      const summary = summarizeRef(ref);
      if (summary) lines.push(`  ${summary}`);
      if (url) lines.push(`  ${url}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function registerReportCommands(program: Command) {
  const report = program.command('report').description('Generate evidence summaries');

  report
    .command('brief')
    .option('--node <id>', 'Generate brief for a specific node')
    .option('--top <n>', 'Show top N hypotheses', '10')
    .option('--max-refs <n>', 'Maximum references per hypothesis', '5')
    .option('--include-unreferenced', 'Include hypotheses with no references', false)
    .option('--markdown', 'Output Markdown brief', false)
    .description('Generate a concise hypothesis evidence brief')
    .action((cmdOpts: {
      node?: string;
      top: string;
      maxRefs: string;
      includeUnreferenced: boolean;
      markdown: boolean;
    }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const propagated = propagateTrust(data.nodes, data.edges, data.rootId);
      data.nodes = propagated.nodes;
      data.edges = propagated.edges;

      const ranked = rankHypotheses(data, {
        includeUnreferenced: cmdOpts.includeUnreferenced,
        includeRoot: false,
      });

      const maxRefs = Number.parseInt(cmdOpts.maxRefs, 10);
      const safeMaxRefs = Number.isFinite(maxRefs) && maxRefs > 0 ? maxRefs : 5;

      let selected = ranked;
      if (cmdOpts.node) {
        selected = ranked.filter((item) => item.id === cmdOpts.node);
        if (selected.length === 0) {
          console.error(`Node ${cmdOpts.node} not found or excluded by current filters.`);
          process.exit(1);
        }
      } else {
        const top = Number.parseInt(cmdOpts.top, 10);
        selected = ranked.slice(0, Number.isFinite(top) && top > 0 ? top : 10);
      }

      const enriched = selected.map((item) => ({
        ...item,
        references: [...item.references].sort((a, b) => refSortValue(b) - refSortValue(a)).slice(0, safeMaxRefs),
      }));

      if (cmdOpts.markdown) {
        console.log(buildMarkdownBrief(enriched));
        return;
      }

      if ((opts.format as OutputFormat) === 'json') {
        const result = {
          generatedAt: new Date().toISOString(),
          file: opts.file,
          hypotheses: enriched.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            trust: item.trust,
            evidenceCount: item.evidenceCount,
            evidenceScore: item.evidenceScore,
            rankScore: item.rankScore,
            references: item.references.map((ref) => ({
              id: ref.id,
              title: ref.title,
              year: ref.year,
              studyType: ref.studyType,
              effectDirection: ref.effectDirection,
              replicationStatus: ref.replicationStatus,
              summary: summarizeRef(ref),
              url: ref.url ?? (ref.doi ? `https://doi.org/${ref.doi}` : undefined),
            })),
          })),
        };
        console.log(formatOutput(result, 'json'));
        return;
      }

      const rows = enriched.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        rankScore: item.rankScore,
        evidenceScore: item.evidenceScore,
        evidenceCount: item.evidenceCount,
        topRefs: item.references.map((r) => `${r.title} (${r.year})`).join('; '),
      }));
      console.log(formatOutput(rows, opts.format as OutputFormat));
    });
}
