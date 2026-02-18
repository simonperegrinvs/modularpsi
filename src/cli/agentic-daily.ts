#!/usr/bin/env tsx

import { execFileSync } from 'child_process';
import { envBool, envNumber, envString, loadEnvFiles } from './env';
import { resolveVaultPath } from './vault';

function run(args: string[]) {
  execFileSync('npm', args, { stdio: 'inherit' });
}

function main() {
  loadEnvFiles();

  const file = envString('MPSI_FILE', 'research/psi-map-2026.json');
  const vault = resolveVaultPath(envString('MPSI_VAULT', '~/data/modularpsi'));
  const enabled = envBool('MPSI_AGENTIC_ENABLED', false);
  const apply = envBool('MPSI_AGENTIC_APPLY', false);
  const maxQueries = Math.max(1, Math.round(envNumber('MPSI_AGENTIC_MAX_QUERIES', 20)));
  const perSource = Math.max(1, Math.round(envNumber('MPSI_AGENTIC_PER_SOURCE', 8)));
  const maxNewRefs = Math.max(1, Math.round(envNumber('MPSI_AGENTIC_MAX_NEW_REFS', 150)));
  const maxNewNodes = Math.max(0, Math.round(envNumber('MPSI_AGENTIC_MAX_NEW_NODES', 20)));
  const maxTrustDelta = Math.max(0, envNumber('MPSI_AGENTIC_MAX_TRUST_DELTA', 0.35));

  if (!enabled) {
    console.error('Agentic flow disabled. Set MPSI_AGENTIC_ENABLED=1 to run.');
    process.exit(1);
  }

  console.log(`Running agentic daily for file=${file} vault=${vault} mode=${apply ? 'APPLY' : 'DRY_RUN'}`);

  run(['run', '-s', 'mpsi', '--', '-f', file, 'snapshot', 'create', '--vault', vault, '--label', 'agentic-daily']);

  const discoverArgs = [
    'run', '-s', 'mpsi', '--', '-f', file, 'discover', 'run',
    '--vault', vault,
    '--strict',
    '--max-queries', String(maxQueries),
    '--per-source', String(perSource),
    '--max-new-refs', String(maxNewRefs),
    '--max-new-nodes', String(maxNewNodes),
    '--max-trust-delta', String(maxTrustDelta),
  ];
  if (!apply) discoverArgs.push('--dry-run');
  run(discoverArgs);

  run(['run', '-s', 'mpsi', '--', '-f', file, 'hypothesis', 'rank', '--top', '30', '--format', 'table']);
  run(['run', '-s', 'mpsi', '--', '-f', file, 'report', 'brief', '--top', '12', '--max-refs', '4', '--markdown']);
}

main();
