import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export interface GovernanceConfig {
  maxDailyNewNodes: number;
  maxDailyTrustDelta: number;
  requireDescription: boolean;
  requireRefTitleYearDoi: boolean;
  duplicateRejection: boolean;
  fuzzyDuplicateThreshold: number;
}

const DEFAULT_GOVERNANCE: GovernanceConfig = {
  maxDailyNewNodes: 20,
  maxDailyTrustDelta: 2.0,
  requireDescription: true,
  requireRefTitleYearDoi: true,
  duplicateRejection: true,
  fuzzyDuplicateThreshold: 0.85,
};

function configPath(graphFile: string): string {
  return join(dirname(graphFile), '.mpsi-governance.json');
}

export function loadGovernanceConfig(graphFile: string): GovernanceConfig {
  const path = configPath(graphFile);
  if (!existsSync(path)) return { ...DEFAULT_GOVERNANCE };
  try {
    return { ...DEFAULT_GOVERNANCE, ...JSON.parse(readFileSync(path, 'utf-8')) };
  } catch {
    return { ...DEFAULT_GOVERNANCE };
  }
}

export function saveGovernanceConfig(graphFile: string, config: GovernanceConfig): void {
  writeFileSync(configPath(graphFile), JSON.stringify(config, null, 2));
}

export { DEFAULT_GOVERNANCE };
