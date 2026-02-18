#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { createEmptyGraph, graphToJson } from '../io/json-io';
import { formatOutput, type OutputFormat } from './format';
import { registerNodeCommands } from './commands/node';
import { registerEdgeCommands } from './commands/edge';
import { registerTrustCommands } from './commands/trust';
import { registerSearchCommands } from './commands/search';
import { registerCategoryCommands } from './commands/category';
import { registerImportCommands } from './commands/import';
import { registerExportCommands } from './commands/export';
import { registerRefCommands } from './commands/ref';
import { registerReviewCommands } from './commands/review';
import { registerBatchCommands } from './commands/batch';
import { registerLiteratureCommands } from './commands/literature';
import { registerAgentCommands } from './commands/agent';
import { registerVaultCommands } from './commands/vault';
import { registerGovernanceCommands } from './commands/governance';
import { registerSnapshotCommands } from './commands/snapshot';

// ── Last-used file persistence ────────────────────────────────
const RC_PATH = resolve(homedir(), '.mpsirc');

function getDefaultFile(): string {
  if (process.env.MPSI_FILE) return process.env.MPSI_FILE;
  if (existsSync(RC_PATH)) {
    try {
      const saved = readFileSync(RC_PATH, 'utf-8').trim();
      if (saved && existsSync(saved)) return saved;
    } catch { /* ignore */ }
  }
  return './modularpsi.json';
}

function saveLastFile(filePath: string) {
  try {
    writeFileSync(RC_PATH, resolve(filePath));
  } catch { /* ignore */ }
}

// ── CLI setup ─────────────────────────────────────────────────
const program = new Command();

program
  .name('mpsi')
  .description('ModularPsi - Knowledge graph editor for scientific evidence tracking')
  .version('1.0.0')
  .option('-f, --file <path>', 'Graph data file path', getDefaultFile())
  .option('--format <format>', 'Output format (json|table|quiet)', 'json')
  .hook('postAction', () => {
    // Remember the file path after any successful command
    saveLastFile(program.opts().file);
  });

// Init command
program
  .command('init')
  .description('Create a new empty graph file')
  .action(() => {
    const opts = program.opts();
    if (existsSync(opts.file)) {
      console.error(`File ${opts.file} already exists. Use --file to specify a different path.`);
      process.exit(1);
    }
    const data = createEmptyGraph();
    writeFileSync(opts.file, graphToJson(data));
    console.log(formatOutput({ status: 'ok', file: opts.file }, opts.format as OutputFormat));
  });

// Register all command groups
registerNodeCommands(program);
registerEdgeCommands(program);
registerTrustCommands(program);
registerSearchCommands(program);
registerCategoryCommands(program);
registerImportCommands(program);
registerExportCommands(program);
registerRefCommands(program);
registerReviewCommands(program);
registerBatchCommands(program);
registerLiteratureCommands(program);
registerAgentCommands(program);
registerVaultCommands(program);
registerGovernanceCommands(program);
registerSnapshotCommands(program);

program.parse();
