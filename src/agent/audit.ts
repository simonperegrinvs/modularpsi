import { mkdirSync, appendFileSync } from 'fs';
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
  validationOutcome: 'accepted' | 'skipped-duplicate' | 'rejected';
  reason?: string;
  before: unknown;
  after: unknown;
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
