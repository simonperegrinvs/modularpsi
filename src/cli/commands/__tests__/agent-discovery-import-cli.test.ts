import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createEmptyGraph, graphToJson, jsonToGraph } from '../../../io/json-io';
import { writeDiscoveryEvent, type DiscoveryEvent } from '../../../agent/discovery';

function fakeQueuedEvent(overrides: Partial<DiscoveryEvent> = {}): DiscoveryEvent {
  return {
    timestamp: '2026-02-18T10:00:00.000Z',
    action: 'discover',
    candidateId: 'cand-cli-1',
    source: 'semantic-scholar',
    discoveredAt: '2026-02-18T10:00:00.000Z',
    query: 'psi ganzfeld',
    title: 'Meta-analysis of psi ganzfeld research',
    authors: ['C. Honorton'],
    year: 1985,
    doi: '10.1000/ganzfeld-cli',
    url: 'https://example.org/ganzfeld',
    semanticScholarId: 'S2-GANZFELD-CLI',
    decision: 'queued',
    runId: 'run-cli-a',
    ...overrides,
  };
}

describe('agent discovery import CLI', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function createWorkspace(): { dir: string; graphFile: string; homeDir: string } {
    const dir = mkdtempSync(join(tmpdir(), 'mpsi-cli-import-'));
    const homeDir = join(dir, 'home');
    mkdirSync(homeDir, { recursive: true });
    const graphFile = join(dir, 'graph.json');
    dirs.push(dir);
    return { dir, graphFile, homeDir };
  }

  function runCli(
    cwd: string,
    homeDir: string,
    args: string[],
  ): string {
    return execFileSync(
      'npm',
      ['run', '--silent', 'mpsi', '--', ...args],
      {
        cwd,
        env: { ...process.env, HOME: homeDir },
        encoding: 'utf-8',
      },
    );
  }

  it('creates nodes through discovery import when auto-node-growth is enabled', () => {
    const ws = createWorkspace();
    const data = createEmptyGraph();
    data.nodes.push({
      id: 'P2',
      name: 'Ganzfeld',
      description: 'Ganzfeld node',
      categoryId: 'general',
      keywords: ['ganzfeld', 'telepathy'],
      type: 0,
      trust: 0.6,
      referenceIds: [],
    });
    writeFileSync(ws.graphFile, graphToJson(data));
    writeDiscoveryEvent(ws.dir, fakeQueuedEvent({
      candidateId: 'cand-cli-node',
      title: 'Ganzfeld telepathy signal reliability analysis',
      query: 'ganzfeld telepathy psi',
      doi: '10.1000/ganzfeld-cli-node',
    }));

    const output = runCli(process.cwd(), ws.homeDir, [
      '--format', 'json',
      '-f', ws.graphFile,
      'agent', 'discovery', 'import',
      '--no-scope-filter',
      '--auto-node-growth',
      '--max-new-nodes', '1',
      '--min-node-confidence', '0.5',
      '--scope-keyword', 'psi', 'ganzfeld', 'telepathy',
    ]);
    const parsed = JSON.parse(output) as {
      summary: { nodesCreated: number; createdNodeIds: string[] };
    };
    expect(parsed.summary.nodesCreated).toBe(1);
    expect(parsed.summary.createdNodeIds).toHaveLength(1);

    const updatedGraph = jsonToGraph(readFileSync(ws.graphFile, 'utf-8'));
    expect(updatedGraph.nodes.some((node) => node.id === parsed.summary.createdNodeIds[0])).toBe(true);
  });

  it('returns structured skip reasons when zero nodes are created', () => {
    const ws = createWorkspace();
    writeFileSync(ws.graphFile, graphToJson(createEmptyGraph()));
    writeDiscoveryEvent(ws.dir, fakeQueuedEvent({
      candidateId: 'cand-cli-no-node',
      title: 'General methodology in replication workflows',
      query: 'replication signal',
      abstract: 'methodology and replication practices',
      doi: '10.1000/ganzfeld-cli-none',
    }));

    const output = runCli(process.cwd(), ws.homeDir, [
      '--format', 'json',
      '-f', ws.graphFile,
      'agent', 'discovery', 'import',
      '--no-scope-filter',
      '--auto-node-growth',
      '--max-new-nodes', '2',
      '--min-node-confidence', '0.95',
      '--scope-keyword', 'psi', 'ganzfeld',
    ]);
    const parsed = JSON.parse(output) as {
      summary: { nodesCreated: number; skipReasons: Array<{ code: string; count: number }> };
    };
    expect(parsed.summary.nodesCreated).toBe(0);
    expect(parsed.summary.skipReasons.some((reason) => reason.code === 'low-node-confidence')).toBe(true);
  });
});
