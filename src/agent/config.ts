import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { ReviewStatus } from '../domain/types';

export interface AgentConfig {
  searchApis: string[];
  maxResultsPerQuery: number;
  maxQueriesPerRun: number;
  maxNewNodesPerRun: number;
  maxNewRefsPerRun: number;
  citationSnowballsPerRun: number;
  defaultReviewStatus: ReviewStatus;
  yearRange: [number, number];
  focusKeywords: string[];
  excludeKeywords: string[];
  rateLimitMs: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  searchApis: ['semantic-scholar', 'openalex'],
  maxResultsPerQuery: 20,
  maxQueriesPerRun: 30,
  maxNewNodesPerRun: 5,
  maxNewRefsPerRun: 20,
  citationSnowballsPerRun: 25,
  defaultReviewStatus: 'draft',
  yearRange: [1970, 2026],
  focusKeywords: [],
  excludeKeywords: [],
  rateLimitMs: 1000,
};

function configPath(graphFile: string): string {
  return join(dirname(graphFile), '.mpsi-agent-config.json');
}

export function loadAgentConfig(graphFile: string): AgentConfig {
  const path = configPath(graphFile);
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(path, 'utf-8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAgentConfig(graphFile: string, config: AgentConfig): void {
  writeFileSync(configPath(graphFile), JSON.stringify(config, null, 2));
}
