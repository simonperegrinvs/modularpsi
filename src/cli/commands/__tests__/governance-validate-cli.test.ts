import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createEmptyGraph, graphToJson } from '../../../io/json-io';

describe('governance validate CLI', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function createWorkspace(): { dir: string; graphFile: string; homeDir: string } {
    const dir = mkdtempSync(join(tmpdir(), 'mpsi-cli-governance-'));
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

  it('treats hypothesis daily cap exceedance as advisory warning, not a blocking error', () => {
    const ws = createWorkspace();
    const today = new Date().toISOString().slice(0, 10);
    const data = createEmptyGraph();
    data.references.push({
      id: 'ref-1',
      title: 'Ref 1',
      authors: ['A'],
      year: 2024,
      publication: '',
      publisher: '',
      citation: '',
      pageStart: 0,
      pageEnd: 0,
      volume: 0,
      description: '',
      doi: '',
      url: '',
      semanticScholarId: '',
      openAlexId: '',
      abstract: '',
    });
    data.hypotheses.push({
      id: 'hyp-1',
      statement: 'A hypothesis',
      linkedNodeIds: ['P1'],
      supportRefIds: ['ref-1'],
      contradictRefIds: [],
      constraintEdgeIds: [],
      score: 0.5,
      status: 'draft',
      createdAt: `${today}T10:00:00.000Z`,
    });
    writeFileSync(ws.graphFile, graphToJson(data));
    writeFileSync(join(ws.dir, '.mpsi-governance.json'), JSON.stringify({
      maxDailyNewNodes: 20,
      maxDailyNewHypotheses: 1,
      maxDailyConstraintEdges: 40,
      maxDailyTrustDelta: 2,
      requireDescription: false,
      requireRefTitleYearDoi: false,
      allowExternalIdLocatorFallback: true,
      allowBibliographicFallback: true,
      requireHypothesisEvidence: true,
      duplicateRejection: true,
      fuzzyDuplicateThreshold: 0.85,
    }, null, 2));

    const output = runCli(process.cwd(), ws.homeDir, [
      '--format', 'json',
      '-f', ws.graphFile,
      'governance', 'validate',
    ]);
    const parsed = JSON.parse(output) as {
      valid: boolean;
      errors: string[];
      warnings: string[];
    };

    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.warnings.some((warning) => warning.includes('Daily hypothesis cap reached (advisory)'))).toBe(true);
  });
});
