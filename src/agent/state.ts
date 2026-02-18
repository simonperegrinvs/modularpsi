import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export interface AgentState {
  lastRunTimestamp: string;
  lastRunId: string;
  totalRuns: number;
  recentSearchQueries: string[];
  searchCursors: Record<string, string>;
}

const DEFAULT_STATE: AgentState = {
  lastRunTimestamp: '',
  lastRunId: '',
  totalRuns: 0,
  recentSearchQueries: [],
  searchCursors: {},
};

function statePath(graphFile: string): string {
  return join(dirname(graphFile), '.mpsi-agent-state.json');
}

export function loadAgentState(graphFile: string): AgentState {
  const path = statePath(graphFile);
  if (!existsSync(path)) return { ...DEFAULT_STATE };
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(readFileSync(path, 'utf-8')) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveAgentState(graphFile: string, state: AgentState): void {
  writeFileSync(statePath(graphFile), JSON.stringify(state, null, 2));
}

export function resetAgentState(graphFile: string): void {
  saveAgentState(graphFile, { ...DEFAULT_STATE });
}
