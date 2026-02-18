import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { initVault, syncGraphToVault, syncVaultToGraph, getVaultStatus } from '../../vault/sync';
import { formatOutput, type OutputFormat } from '../format';

export function registerVaultCommands(program: Command) {
  const vault = program.command('vault').description('Obsidian vault sync');

  vault
    .command('init')
    .requiredOption('--path <dir>', 'Vault directory path')
    .description('Initialize an Obsidian vault directory structure')
    .action((cmdOpts: { path: string }) => {
      const opts = program.opts();
      initVault(cmdOpts.path);
      console.log(formatOutput({ status: 'ok', path: cmdOpts.path }, opts.format as OutputFormat));
    });

  vault
    .command('sync')
    .requiredOption('--path <dir>', 'Vault directory path')
    .option('--direction <dir>', 'Sync direction: graph-to-vault, vault-to-graph, or both', 'graph-to-vault')
    .description('Sync between graph and Obsidian vault')
    .action((cmdOpts: { path: string; direction: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const result: Record<string, unknown> = { direction: cmdOpts.direction };

      if (cmdOpts.direction === 'graph-to-vault' || cmdOpts.direction === 'both') {
        initVault(cmdOpts.path);
        const syncResult = syncGraphToVault(data, cmdOpts.path);
        result.graphToVault = syncResult;
      }

      if (cmdOpts.direction === 'vault-to-graph' || cmdOpts.direction === 'both') {
        const vaultResult = syncVaultToGraph(data, cmdOpts.path);
        if (vaultResult.nodesUpdated > 0 || vaultResult.refsUpdated > 0) {
          writeFileSync(opts.file, graphToJson(data));
        }
        result.vaultToGraph = vaultResult;
      }

      console.log(formatOutput({ status: 'ok', ...result }, opts.format as OutputFormat));
    });

  vault
    .command('status')
    .requiredOption('--path <dir>', 'Vault directory path')
    .description('Show vault sync status')
    .action((cmdOpts: { path: string }) => {
      const opts = program.opts();
      const status = getVaultStatus(cmdOpts.path);
      console.log(formatOutput(status, opts.format as OutputFormat));
    });
}
