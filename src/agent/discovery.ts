import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { DiscoveryCandidate, DiscoveryDecision } from './search/types';
import type { LiteratureSearchResult } from './search/types';
import type { Reference } from '../domain/types';
import { isDuplicate } from './search/dedup';

export interface DiscoveryEvent extends DiscoveryCandidate {
  timestamp: string;
  action: 'discover' | 'decision-update' | 'retry';
}

export interface DiscoveryListFilters {
  date?: string;
  status?: DiscoveryDecision;
  query?: string;
  api?: DiscoveryCandidate['source'];
}

function discoveryDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

export function abstractChecksum(abstract?: string): string | undefined {
  if (!abstract) return undefined;
  return simpleHash(normalizeText(abstract));
}

export function computeCandidateId(result: LiteratureSearchResult): string {
  if (result.doi) return `doi:${result.doi.toLowerCase()}`;
  if (result.semanticScholarId) return `s2:${result.semanticScholarId}`;
  if (result.openAlexId) return `oa:${result.openAlexId}`;
  return `title-year:${simpleHash(`${normalizeText(result.title)}|${result.year}`)}`;
}

export function decisionForSearchResult(
  result: LiteratureSearchResult,
  existingRefs: Reference[],
): { decision: DiscoveryDecision; reason?: string } {
  const dup = isDuplicate(result, existingRefs);
  if (dup.duplicate) {
    return {
      decision: 'duplicate',
      reason: `matched ${dup.matchedRefId} (${dup.matchType})`,
    };
  }
  return { decision: 'queued' };
}

export function createDiscoveryEventFromSearchResult(
  result: LiteratureSearchResult,
  query: string,
  runId: string,
  existingRefs: Reference[],
  overrides?: Partial<DiscoveryEvent>,
): DiscoveryEvent {
  const now = new Date().toISOString();
  const decision = decisionForSearchResult(result, existingRefs);
  return {
    candidateId: computeCandidateId(result),
    source: result.source,
    discoveredAt: now,
    query,
    title: result.title,
    authors: result.authors,
    year: result.year,
    doi: result.doi,
    abstract: result.abstract,
    abstractChecksum: abstractChecksum(result.abstract),
    url: result.url,
    semanticScholarId: result.semanticScholarId,
    openAlexId: result.openAlexId,
    decision: decision.decision,
    decisionReason: decision.reason,
    runId,
    timestamp: now,
    action: 'discover',
    ...overrides,
  };
}

function discoveryPath(baseDir: string, date: string): string {
  return join(baseDir, 'research', 'discovery', date, 'candidates.jsonl');
}

export function writeDiscoveryEvent(baseDir: string, event: DiscoveryEvent): void {
  const date = discoveryDate(event.timestamp);
  const dir = join(baseDir, 'research', 'discovery', date);
  mkdirSync(dir, { recursive: true });
  appendFileSync(discoveryPath(baseDir, date), JSON.stringify(event) + '\n');
}

function readDiscoveryEventsForDate(baseDir: string, date: string): DiscoveryEvent[] {
  const path = discoveryPath(baseDir, date);
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
    return lines.map((line) => JSON.parse(line) as DiscoveryEvent);
  } catch {
    return [];
  }
}

export function listDiscoveryDates(baseDir: string): string[] {
  const dir = join(baseDir, 'research', 'discovery');
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

export function readDiscoveryEvents(baseDir: string, date?: string): DiscoveryEvent[] {
  if (date) return readDiscoveryEventsForDate(baseDir, date);
  const dates = listDiscoveryDates(baseDir);
  return dates.flatMap((d) => readDiscoveryEventsForDate(baseDir, d));
}

function latestEventsByCandidate(events: DiscoveryEvent[]): DiscoveryEvent[] {
  const latest = new Map<string, DiscoveryEvent>();
  for (const event of events) {
    const current = latest.get(event.candidateId);
    if (!current || event.timestamp >= current.timestamp) {
      latest.set(event.candidateId, event);
    }
  }
  return [...latest.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function listDiscoveryCandidates(baseDir: string, filters: DiscoveryListFilters): DiscoveryEvent[] {
  const events = readDiscoveryEvents(baseDir, filters.date);
  const latest = latestEventsByCandidate(events);
  return latest.filter((item) => {
    if (filters.status && item.decision !== filters.status) return false;
    if (filters.api && item.source !== filters.api) return false;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const inQuery = item.query.toLowerCase().includes(q);
      const inTitle = item.title.toLowerCase().includes(q);
      if (!inQuery && !inTitle) return false;
    }
    return true;
  });
}

export function summarizeDiscovery(baseDir: string, date?: string): {
  date: string | 'all';
  totalEvents: number;
  totalCandidates: number;
  byDecision: Record<DiscoveryDecision, number>;
} {
  const events = readDiscoveryEvents(baseDir, date);
  const latest = latestEventsByCandidate(events);
  const byDecision: Record<DiscoveryDecision, number> = {
    queued: 0,
    parsed: 0,
    'imported-draft': 0,
    duplicate: 0,
    rejected: 0,
    deferred: 0,
  };

  for (const event of latest) {
    byDecision[event.decision]++;
  }

  return {
    date: date ?? 'all',
    totalEvents: events.length,
    totalCandidates: latest.length,
    byDecision,
  };
}

export function retryDiscoveryCandidate(
  baseDir: string,
  candidateId: string,
  runId: string,
): DiscoveryEvent | null {
  const events = readDiscoveryEvents(baseDir);
  const latest = latestEventsByCandidate(events).find((e) => e.candidateId === candidateId);
  if (!latest) return null;

  const now = new Date().toISOString();
  const retried: DiscoveryEvent = {
    ...latest,
    decision: 'queued',
    action: 'retry',
    decisionReason: 'manual-retry',
    runId,
    timestamp: now,
    discoveredAt: latest.discoveredAt || now,
  };

  writeDiscoveryEvent(baseDir, retried);
  return retried;
}
