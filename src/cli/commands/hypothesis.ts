import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { graphToJson, jsonToGraph } from '../../io/json-io';
import { createHypothesis } from '../../domain/hypothesis';
import type { HypothesisStatus } from '../../domain/types';
import { formatOutput, type OutputFormat } from '../format';

function parseList(value?: string): string[] {
  if (!value) return [];
  return value.split(',').map((x) => x.trim()).filter(Boolean);
}

export function registerHypothesisCommands(program: Command) {
  const hypothesis = program.command('hypothesis').description('Manage hypothesis cards');

  hypothesis
    .command('list')
    .option('--status <status>', 'Filter by status')
    .description('List hypothesis cards')
    .action((cmdOpts: { status?: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      let items = data.hypotheses;
      if (cmdOpts.status) {
        items = items.filter((h) => h.status === cmdOpts.status);
      }
      console.log(formatOutput(items, opts.format as OutputFormat));
    });

  hypothesis
    .command('show')
    .argument('<id>', 'Hypothesis ID')
    .description('Show full hypothesis details')
    .action((id: string) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const item = data.hypotheses.find((h) => h.id === id);
      if (!item) {
        console.error(`Hypothesis ${id} not found`);
        process.exit(1);
      }
      console.log(formatOutput(item, opts.format as OutputFormat));
    });

  hypothesis
    .command('add')
    .requiredOption('--statement <text>', 'Hypothesis statement')
    .option('--linked-nodes <ids>', 'Comma-separated node IDs')
    .option('--support-refs <ids>', 'Comma-separated supporting reference IDs')
    .option('--contradict-refs <ids>', 'Comma-separated contradicting reference IDs')
    .option('--constraint-edges <ids>', 'Comma-separated constraint edge IDs')
    .option('--score <n>', 'Initial score', '0')
    .option('--status <status>', 'Initial status', 'draft')
    .option('--run-id <id>', 'Provenance run ID')
    .description('Add a new hypothesis card')
    .action((cmdOpts: {
      statement: string;
      linkedNodes?: string;
      supportRefs?: string;
      contradictRefs?: string;
      constraintEdges?: string;
      score?: string;
      status?: string;
      runId?: string;
    }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      const created = createHypothesis(data.hypotheses, {
        statement: cmdOpts.statement,
        linkedNodeIds: parseList(cmdOpts.linkedNodes),
        supportRefIds: parseList(cmdOpts.supportRefs),
        contradictRefIds: parseList(cmdOpts.contradictRefs),
        constraintEdgeIds: parseList(cmdOpts.constraintEdges),
        score: cmdOpts.score ? parseFloat(cmdOpts.score) : 0,
        status: (cmdOpts.status as HypothesisStatus) ?? 'draft',
        createdByRunId: cmdOpts.runId,
      });

      data.hypotheses.push(created);
      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput(created, opts.format as OutputFormat));
    });

  hypothesis
    .command('update')
    .argument('<id>', 'Hypothesis ID')
    .option('--statement <text>', 'Updated statement')
    .option('--linked-nodes <ids>', 'Comma-separated node IDs')
    .option('--support-refs <ids>', 'Comma-separated supporting reference IDs')
    .option('--contradict-refs <ids>', 'Comma-separated contradicting reference IDs')
    .option('--constraint-edges <ids>', 'Comma-separated constraint edge IDs')
    .option('--score <n>', 'Updated score')
    .option('--status <status>', 'Updated status')
    .description('Update an existing hypothesis card')
    .action((id: string, cmdOpts: {
      statement?: string;
      linkedNodes?: string;
      supportRefs?: string;
      contradictRefs?: string;
      constraintEdges?: string;
      score?: string;
      status?: string;
    }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const item = data.hypotheses.find((h) => h.id === id);
      if (!item) {
        console.error(`Hypothesis ${id} not found`);
        process.exit(1);
      }

      if (cmdOpts.statement !== undefined) item.statement = cmdOpts.statement.trim();
      if (cmdOpts.linkedNodes !== undefined) item.linkedNodeIds = parseList(cmdOpts.linkedNodes);
      if (cmdOpts.supportRefs !== undefined) item.supportRefIds = parseList(cmdOpts.supportRefs);
      if (cmdOpts.contradictRefs !== undefined) item.contradictRefIds = parseList(cmdOpts.contradictRefs);
      if (cmdOpts.constraintEdges !== undefined) item.constraintEdgeIds = parseList(cmdOpts.constraintEdges);
      if (cmdOpts.score !== undefined) item.score = parseFloat(cmdOpts.score);
      if (cmdOpts.status !== undefined) item.status = cmdOpts.status as HypothesisStatus;
      item.updatedAt = new Date().toISOString();

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput(item, opts.format as OutputFormat));
    });
}
