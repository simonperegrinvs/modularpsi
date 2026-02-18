import { Command } from 'commander';
import { readFileSync } from 'fs';
import type { GraphData } from '../../domain/types';
import { jsonToGraph } from '../../io/json-io';
import { saveSnapshot, listSnapshots, loadSnapshot, rollbackToSnapshot } from '../../agent/snapshot';
import { formatOutput, type OutputFormat } from '../format';

export function registerSnapshotCommands(program: Command) {
  const snapshot = program.command('snapshot').description('Graph snapshot management');

  // ── save ───────────────────────────────────────────────────
  snapshot
    .command('save')
    .option('--trigger <trigger>', 'Snapshot trigger type (manual or daily-auto)', 'manual')
    .description('Save a snapshot of the current graph')
    .action((cmdOpts: { trigger: string }) => {
      const opts = program.opts();
      const data: GraphData = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const trigger = cmdOpts.trigger as 'manual' | 'daily-auto';
      const meta = saveSnapshot(opts.file, data, trigger);
      console.log(formatOutput({ status: 'ok', snapshot: meta }, opts.format as OutputFormat));
    });

  // ── list ───────────────────────────────────────────────────
  snapshot
    .command('list')
    .description('List all available snapshots')
    .action(() => {
      const opts = program.opts();
      const snapshots = listSnapshots(opts.file);
      console.log(formatOutput(snapshots, opts.format as OutputFormat));
    });

  // ── show ───────────────────────────────────────────────────
  snapshot
    .command('show <date>')
    .description('Show summary of a snapshot')
    .action((date: string) => {
      const opts = program.opts();
      const snapData = loadSnapshot(opts.file, date);

      if (!snapData) {
        console.error(`Snapshot ${date} not found`);
        process.exit(1);
      }

      const summary = {
        date,
        nodeCount: snapData.nodes.length,
        edgeCount: snapData.edges.length,
        refCount: snapData.references.length,
      };

      console.log(formatOutput(summary, opts.format as OutputFormat));
    });

  // ── diff ───────────────────────────────────────────────────
  snapshot
    .command('diff <date>')
    .description('Compare a snapshot against the current graph')
    .action((date: string) => {
      const opts = program.opts();
      const currentData: GraphData = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const snapData = loadSnapshot(opts.file, date);

      if (!snapData) {
        console.error(`Snapshot ${date} not found`);
        process.exit(1);
      }

      const diff = {
        snapshotDate: date,
        nodes: {
          snapshot: snapData.nodes.length,
          current: currentData.nodes.length,
          delta: currentData.nodes.length - snapData.nodes.length,
        },
        edges: {
          snapshot: snapData.edges.length,
          current: currentData.edges.length,
          delta: currentData.edges.length - snapData.edges.length,
        },
        references: {
          snapshot: snapData.references.length,
          current: currentData.references.length,
          delta: currentData.references.length - snapData.references.length,
        },
      };

      console.log(formatOutput(diff, opts.format as OutputFormat));
    });

  // ── rollback ───────────────────────────────────────────────
  snapshot
    .command('rollback <date>')
    .option('--force', 'Skip confirmation prompt')
    .description('Rollback the graph to a previous snapshot')
    .action((date: string, cmdOpts: { force?: boolean }) => {
      const opts = program.opts();

      if (!cmdOpts.force) {
        console.error('Rollback is destructive. Use --force to confirm.');
        process.exit(1);
      }

      const result = rollbackToSnapshot(opts.file, date);

      if (!result.ok) {
        console.error(result.error);
        process.exit(1);
      }

      console.log(formatOutput(
        { status: 'ok', rolledBackTo: date, backup: result.backupMeta },
        opts.format as OutputFormat,
      ));
    });
}
