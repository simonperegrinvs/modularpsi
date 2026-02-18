import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { GraphData } from '../domain/types';
import { nodeFilename, refFilename, generateNodeNote, generateRefNote } from './templates';
import { parseFrontmatter } from './frontmatter';

export interface VaultSyncResult {
  nodesWritten: number;
  nodesSkipped: number;
  refsWritten: number;
  refsSkipped: number;
  notesPreserved: number;
}

/** Initialize vault directory structure */
export function initVault(vaultPath: string): void {
  mkdirSync(join(vaultPath, 'nodes'), { recursive: true });
  mkdirSync(join(vaultPath, 'references'), { recursive: true });
  mkdirSync(join(vaultPath, 'agent-runs'), { recursive: true });
}

/** Sync graph data to vault (graph -> vault direction) */
export function syncGraphToVault(data: GraphData, vaultPath: string): VaultSyncResult {
  const result: VaultSyncResult = {
    nodesWritten: 0,
    nodesSkipped: 0,
    refsWritten: 0,
    refsSkipped: 0,
    notesPreserved: 0,
  };

  // Sync nodes by category
  for (const node of data.nodes) {
    const catDir = join(vaultPath, 'nodes', node.categoryId);
    mkdirSync(catDir, { recursive: true });
    const filePath = join(catDir, nodeFilename(node));

    // Preserve human notes section if file exists
    let humanNotes = '';
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, 'utf-8');
      humanNotes = extractHumanNotes(existing);
      if (humanNotes) result.notesPreserved++;
    }

    let content = generateNodeNote(node, data);
    if (humanNotes) {
      content = replaceHumanNotes(content, humanNotes);
    }

    writeFileSync(filePath, content);
    result.nodesWritten++;
  }

  // Sync references by year
  for (const ref of data.references) {
    const yearDir = join(vaultPath, 'references', String(ref.year || 'unknown'));
    mkdirSync(yearDir, { recursive: true });
    const filePath = join(yearDir, refFilename(ref));

    let humanNotes = '';
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, 'utf-8');
      humanNotes = extractReadingNotes(existing);
      if (humanNotes) result.notesPreserved++;
    }

    let content = generateRefNote(ref, data);
    if (humanNotes) {
      content = replaceReadingNotes(content, humanNotes);
    }

    writeFileSync(filePath, content);
    result.refsWritten++;
  }

  return result;
}

/** Read back vault edits to update graph data (vault -> graph direction) */
export function syncVaultToGraph(data: GraphData, vaultPath: string): { nodesUpdated: number; refsUpdated: number } {
  let nodesUpdated = 0;
  let refsUpdated = 0;

  const nodesDir = join(vaultPath, 'nodes');
  if (existsSync(nodesDir)) {
    for (const catDir of readdirSync(nodesDir)) {
      const catPath = join(nodesDir, catDir);
      for (const file of readdirSync(catPath)) {
        if (!file.endsWith('.md')) continue;
        const content = readFileSync(join(catPath, file), 'utf-8');
        const { frontmatter } = parseFrontmatter(content);
        const nodeId = frontmatter.id as string;
        if (!nodeId) continue;

        const node = data.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        let changed = false;
        if (frontmatter.reviewStatus && frontmatter.reviewStatus !== node.reviewStatus) {
          node.reviewStatus = frontmatter.reviewStatus as typeof node.reviewStatus;
          changed = true;
        }
        if (changed) nodesUpdated++;
      }
    }
  }

  const refsDir = join(vaultPath, 'references');
  if (existsSync(refsDir)) {
    for (const yearDir of readdirSync(refsDir)) {
      const yearPath = join(refsDir, yearDir);
      for (const file of readdirSync(yearPath)) {
        if (!file.endsWith('.md')) continue;
        const content = readFileSync(join(yearPath, file), 'utf-8');
        const { frontmatter } = parseFrontmatter(content);
        const refId = frontmatter.id as string;
        if (!refId) continue;

        const ref = data.references.find((r) => r.id === refId);
        if (!ref) continue;

        let changed = false;
        if (frontmatter.reviewStatus && frontmatter.reviewStatus !== ref.reviewStatus) {
          ref.reviewStatus = frontmatter.reviewStatus as typeof ref.reviewStatus;
          changed = true;
        }
        if (changed) refsUpdated++;
      }
    }
  }

  return { nodesUpdated, refsUpdated };
}

/** Get vault status: counts and last sync info */
export function getVaultStatus(vaultPath: string): {
  exists: boolean;
  nodeFiles: number;
  refFiles: number;
  categories: string[];
} {
  if (!existsSync(vaultPath)) {
    return { exists: false, nodeFiles: 0, refFiles: 0, categories: [] };
  }

  let nodeFiles = 0;
  let refFiles = 0;
  const categories: string[] = [];

  const nodesDir = join(vaultPath, 'nodes');
  if (existsSync(nodesDir)) {
    for (const catDir of readdirSync(nodesDir)) {
      categories.push(catDir);
      const catPath = join(nodesDir, catDir);
      nodeFiles += readdirSync(catPath).filter((f: string) => f.endsWith('.md')).length;
    }
  }

  const refsDir = join(vaultPath, 'references');
  if (existsSync(refsDir)) {
    for (const yearDir of readdirSync(refsDir)) {
      refFiles += readdirSync(join(refsDir, yearDir)).filter((f: string) => f.endsWith('.md')).length;
    }
  }

  return { exists: true, nodeFiles, refFiles, categories };
}

// ── Helpers for preserving human notes ──────────────────────

function extractHumanNotes(content: string): string {
  const marker = '## Notes\n';
  const idx = content.indexOf(marker);
  if (idx === -1) return '';
  const afterMarker = content.slice(idx + marker.length);
  // Skip the default placeholder line
  if (afterMarker.startsWith('_Human annotations')) return '';
  return afterMarker.trim();
}

function replaceHumanNotes(content: string, notes: string): string {
  const marker = '## Notes\n';
  const idx = content.indexOf(marker);
  if (idx === -1) return content;
  return content.slice(0, idx + marker.length) + notes + '\n';
}

function extractReadingNotes(content: string): string {
  const marker = '## Reading Notes\n';
  const idx = content.indexOf(marker);
  if (idx === -1) return '';
  const afterMarker = content.slice(idx + marker.length);
  if (afterMarker.startsWith('_Human annotations')) return '';
  return afterMarker.trim();
}

function replaceReadingNotes(content: string, notes: string): string {
  const marker = '## Reading Notes\n';
  const idx = content.indexOf(marker);
  if (idx === -1) return content;
  return content.slice(0, idx + marker.length) + notes + '\n';
}
