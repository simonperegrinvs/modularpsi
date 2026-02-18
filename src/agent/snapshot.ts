import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'fs';
import { join, dirname } from 'path';
import type { GraphData } from '../domain/types';
import { jsonToGraph, graphToJson } from '../io/json-io';

export interface SnapshotMetadata {
  date: string;
  timestamp: string;
  trigger: 'manual' | 'daily-auto' | 'pre-import' | 'pre-rollback';
  runId?: string;
  nodeCount: number;
  edgeCount: number;
  refCount: number;
}

function snapshotDir(graphFile: string): string {
  return join(dirname(graphFile), 'research', 'snapshots');
}

function snapshotPath(graphFile: string, date: string): string {
  return join(snapshotDir(graphFile), `${date}.json`);
}

function metaPath(graphFile: string, date: string): string {
  return join(snapshotDir(graphFile), `${date}.meta.json`);
}

export function saveSnapshot(
  graphFile: string,
  data: GraphData,
  trigger: SnapshotMetadata['trigger'],
  runId?: string,
): SnapshotMetadata {
  const dir = snapshotDir(graphFile);
  mkdirSync(dir, { recursive: true });

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const snapFile = snapshotPath(graphFile, date);

  // If a snapshot already exists for today, append a counter
  let actualDate = date;
  if (existsSync(snapFile)) {
    let counter = 1;
    while (existsSync(snapshotPath(graphFile, `${date}-${counter}`))) {
      counter++;
    }
    actualDate = `${date}-${counter}`;
  }

  const finalPath = snapshotPath(graphFile, actualDate);
  const finalMeta = metaPath(graphFile, actualDate);

  writeFileSync(finalPath, graphToJson(data));

  const meta: SnapshotMetadata = {
    date: actualDate,
    timestamp: now.toISOString(),
    trigger,
    runId,
    nodeCount: data.nodes.length,
    edgeCount: data.edges.length,
    refCount: data.references.length,
  };

  writeFileSync(finalMeta, JSON.stringify(meta, null, 2));
  return meta;
}

export function listSnapshots(graphFile: string): SnapshotMetadata[] {
  const dir = snapshotDir(graphFile);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith('.meta.json'));
  const snapshots: SnapshotMetadata[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      snapshots.push(JSON.parse(content) as SnapshotMetadata);
    } catch {
      // Skip corrupt meta files
    }
  }

  return snapshots.sort((a, b) => a.date.localeCompare(b.date));
}

export function loadSnapshot(graphFile: string, date: string): GraphData | null {
  const path = snapshotPath(graphFile, date);
  if (!existsSync(path)) return null;
  try {
    return jsonToGraph(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

export function rollbackToSnapshot(graphFile: string, date: string): {
  ok: boolean;
  error?: string;
  backupMeta?: SnapshotMetadata;
} {
  const snapPath = snapshotPath(graphFile, date);
  if (!existsSync(snapPath)) {
    return { ok: false, error: `Snapshot ${date} not found` };
  }

  if (!existsSync(graphFile)) {
    return { ok: false, error: `Graph file ${graphFile} not found` };
  }

  // Save pre-rollback backup
  const currentData = jsonToGraph(readFileSync(graphFile, 'utf-8'));
  const backupMeta = saveSnapshot(graphFile, currentData, 'pre-rollback');

  // Overwrite current graph with snapshot
  copyFileSync(snapPath, graphFile);

  return { ok: true, backupMeta };
}
