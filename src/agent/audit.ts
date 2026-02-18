import { mkdirSync, appendFileSync, readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface AuditEntry {
  timestamp: string;
  runId: string;
  action: string;
  entityType: 'node' | 'edge' | 'reference';
  entityId: string;
  sourceApis?: string[];
  aiClassification?: string;
  mappingConfidence?: number;
  validationOutcome: 'accepted' | 'skipped-duplicate' | 'rejected' | 'cap-exceeded';
  reason?: string;
  before: unknown;
  after: unknown;
  aiRationale?: string;
  validationErrors?: string[];
}

export function writeAuditEntry(baseDir: string, entry: AuditEntry): void {
  const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
  const dir = join(baseDir, 'research', 'runs', date);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'audit.jsonl');
  appendFileSync(path, JSON.stringify(entry) + '\n');
}

export function createAuditEntry(
  runId: string,
  action: string,
  entityType: AuditEntry['entityType'],
  entityId: string,
  outcome: AuditEntry['validationOutcome'],
  after: unknown,
  opts?: Partial<AuditEntry>,
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    runId,
    action,
    entityType,
    entityId,
    validationOutcome: outcome,
    before: null,
    after,
    ...opts,
  };
}

// ── Read Helpers ────────────────────────────────────────────

export function readAuditEntries(baseDir: string, date: string): AuditEntry[] {
  const dir = join(baseDir, 'research', 'runs', date);
  const path = join(dir, 'audit.jsonl');
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
    return lines.map((line) => JSON.parse(line) as AuditEntry);
  } catch {
    return [];
  }
}

export function readTodayAuditEntries(baseDir: string): AuditEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  return readAuditEntries(baseDir, today);
}

export function listAuditDates(baseDir: string): string[] {
  const runsDir = join(baseDir, 'research', 'runs');
  if (!existsSync(runsDir)) return [];
  try {
    return readdirSync(runsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}
