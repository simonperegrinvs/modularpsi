import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  listDiscoveryCandidates,
  listDiscoveryDates,
  readDiscoveryEvents,
  retryDiscoveryCandidate,
  summarizeDiscovery,
  writeDiscoveryEvent,
  type DiscoveryEvent,
} from '../discovery';

function fakeEvent(overrides: Partial<DiscoveryEvent>): DiscoveryEvent {
  return {
    timestamp: '2026-02-18T10:00:00.000Z',
    action: 'discover',
    candidateId: 'cand-1',
    source: 'semantic-scholar',
    discoveredAt: '2026-02-18T10:00:00.000Z',
    query: 'ganzfeld psi',
    title: 'Ganzfeld Signal',
    authors: ['A. Author'],
    year: 2024,
    decision: 'queued',
    runId: 'run-1',
    ...overrides,
  };
}

describe('discovery registry', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function createBaseDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'mpsi-discovery-test-'));
    dirs.push(dir);
    return dir;
  }

  it('writes and reads discovery events by date', () => {
    const baseDir = createBaseDir();
    writeDiscoveryEvent(baseDir, fakeEvent({}));
    writeDiscoveryEvent(baseDir, fakeEvent({
      candidateId: 'cand-2',
      timestamp: '2026-02-19T09:00:00.000Z',
      discoveredAt: '2026-02-19T09:00:00.000Z',
    }));

    const d1 = readDiscoveryEvents(baseDir, '2026-02-18');
    const d2 = readDiscoveryEvents(baseDir, '2026-02-19');

    expect(d1).toHaveLength(1);
    expect(d2).toHaveLength(1);
    expect(listDiscoveryDates(baseDir)).toEqual(['2026-02-18', '2026-02-19']);
  });

  it('returns latest candidate state and supports filtering', () => {
    const baseDir = createBaseDir();
    writeDiscoveryEvent(baseDir, fakeEvent({ candidateId: 'cand-1', decision: 'queued' }));
    writeDiscoveryEvent(baseDir, fakeEvent({
      candidateId: 'cand-1',
      decision: 'duplicate',
      timestamp: '2026-02-18T11:00:00.000Z',
      action: 'decision-update',
    }));
    writeDiscoveryEvent(baseDir, fakeEvent({
      candidateId: 'cand-2',
      title: 'Remote Viewing Protocol',
      query: 'remote viewing',
      decision: 'parsed',
      timestamp: '2026-02-18T12:00:00.000Z',
    }));

    const allLatest = listDiscoveryCandidates(baseDir, {});
    const duplicateOnly = listDiscoveryCandidates(baseDir, { status: 'duplicate' });
    const queryFiltered = listDiscoveryCandidates(baseDir, { query: 'remote' });

    expect(allLatest).toHaveLength(2);
    expect(allLatest.find((c) => c.candidateId === 'cand-1')?.decision).toBe('duplicate');
    expect(duplicateOnly.map((c) => c.candidateId)).toEqual(['cand-1']);
    expect(queryFiltered.map((c) => c.candidateId)).toEqual(['cand-2']);
  });

  it('summarizes by latest decision and supports manual retry', () => {
    const baseDir = createBaseDir();
    writeDiscoveryEvent(baseDir, fakeEvent({ candidateId: 'cand-1', decision: 'rejected' }));
    writeDiscoveryEvent(baseDir, fakeEvent({
      candidateId: 'cand-2',
      decision: 'imported-draft',
      timestamp: '2026-02-18T10:30:00.000Z',
    }));

    const before = summarizeDiscovery(baseDir, '2026-02-18');
    expect(before.totalCandidates).toBe(2);
    expect(before.byDecision.rejected).toBe(1);
    expect(before.byDecision['imported-draft']).toBe(1);

    const retried = retryDiscoveryCandidate(baseDir, 'cand-1', 'retry-run-1');
    expect(retried?.decision).toBe('queued');
    expect(retried?.action).toBe('retry');
    expect(retried?.runId).toBe('retry-run-1');

    const latest = listDiscoveryCandidates(baseDir, {});
    expect(latest.find((c) => c.candidateId === 'cand-1')?.decision).toBe('queued');
  });
});
