import { Command } from 'commander';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { basename, join, resolve } from 'path';
import { compactTimestamp, DEFAULT_VAULT, resolveVaultPath } from '../vault';
import { formatOutput, type OutputFormat } from '../format';

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function registerSnapshotCommands(program: Command) {
  const snapshot = program.command('snapshot').description('Create and restore graph snapshots');

  snapshot
    .command('create')
    .option('--vault <path>', `Vault base folder (default: ${DEFAULT_VAULT})`)
    .option('--label <label>', 'Optional label suffix')
    .description('Create a snapshot of the current graph file')
    .action((cmdOpts: { vault?: string; label?: string }) => {
      const opts = program.opts();
      const vault = resolveVaultPath(cmdOpts.vault);
      const snapshotsDir = join(vault, 'snapshots');
      ensureDir(snapshotsDir);

      const safeLabel = cmdOpts.label ? `-${cmdOpts.label.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
      const fileName = `psi-map-${compactTimestamp()}${safeLabel}.json`;
      const output = join(snapshotsDir, fileName);
      copyFileSync(opts.file, output);

      console.log(formatOutput({ status: 'ok', file: output }, opts.format as OutputFormat));
    });

  snapshot
    .command('list')
    .option('--vault <path>', `Vault base folder (default: ${DEFAULT_VAULT})`)
    .description('List available snapshots')
    .action((cmdOpts: { vault?: string }) => {
      const opts = program.opts();
      const vault = resolveVaultPath(cmdOpts.vault);
      const snapshotsDir = join(vault, 'snapshots');
      if (!existsSync(snapshotsDir)) {
        console.log(formatOutput([], opts.format as OutputFormat));
        return;
      }
      const files = readdirSync(snapshotsDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()
        .map((name) => ({ name, path: join(snapshotsDir, name) }));
      console.log(formatOutput(files, opts.format as OutputFormat));
    });

  snapshot
    .command('rollback')
    .argument('<snapshot>', 'Snapshot file name or absolute path')
    .option('--vault <path>', `Vault base folder (default: ${DEFAULT_VAULT})`)
    .description('Restore graph from snapshot to current --file')
    .action((snapshotArg: string, cmdOpts: { vault?: string }) => {
      const opts = program.opts();
      const vault = resolveVaultPath(cmdOpts.vault);
      const snapshotsDir = join(vault, 'snapshots');

      const candidate = snapshotArg.includes('/') ? resolve(snapshotArg) : join(snapshotsDir, snapshotArg);
      if (!existsSync(candidate)) {
        console.error(`Snapshot not found: ${candidate}`);
        process.exit(1);
      }

      copyFileSync(candidate, opts.file);
      console.log(formatOutput({ status: 'ok', restoredFrom: candidate, restoredTo: basename(opts.file) }, opts.format as OutputFormat));
    });
}

