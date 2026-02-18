import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildRunNoteMarkdown, writeRunNote } from '../run-notes';

describe('run notes', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function createDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'mpsi-run-note-test-'));
    dirs.push(dir);
    return dir;
  }

  it('builds markdown with required sections', () => {
    const content = buildRunNoteMarkdown({
      runId: 'run-22',
      date: '2026-02-18',
      queries: ['ganzfeld psi', 'remote viewing'],
      discoverySummary: {
        totalEvents: 30,
        totalCandidates: 22,
        byDecision: { queued: 10, duplicate: 12 },
      },
      importedDraftRefs: 5,
      topHypotheses: [{ id: 'hyp-1', statement: 'A', score: 0.73, status: 'draft' }],
      rejectedNearMisses: [{ candidateId: 'cand-1', title: 'Noise', reason: 'out-of-scope' }],
    });

    expect(content).toContain('# Agent Run run-22');
    expect(content).toContain('## Queries Run');
    expect(content).toContain('## Proposed Hypotheses');
    expect(content).toContain('## Rejected Near-Misses');
  });

  it('writes run notes to vault/agent-runs with deterministic filename', () => {
    const vault = createDir();
    const result = writeRunNote(vault, {
      runId: 'run-99',
      date: '2026-02-18',
      queries: [],
      discoverySummary: {
        totalEvents: 0,
        totalCandidates: 0,
        byDecision: {},
      },
      importedDraftRefs: 0,
      topHypotheses: [],
      rejectedNearMisses: [],
    });

    expect(result.filePath.endsWith('agent-runs/2026-02-18-run-99.md')).toBe(true);
    const written = readFileSync(result.filePath, 'utf-8');
    expect(written).toContain('# Agent Run run-99');
  });
});
