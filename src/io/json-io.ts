import type { GraphData } from '../domain/types';
import { DEFAULT_CATEGORIES } from '../domain/types';

const CURRENT_VERSION = 1;

/** Create a new empty graph */
export function createEmptyGraph(prefix: 'P' | 'M' = 'P'): GraphData {
  return {
    version: CURRENT_VERSION,
    prefix,
    rootId: `${prefix}1`,
    lastNodeNumber: 1,
    nodes: [
      {
        id: `${prefix}1`,
        name: 'Root',
        description: '',
        categoryId: 'general',
        keywords: [],
        type: 0,
        trust: 1.0,
        referenceIds: [],
      },
    ],
    edges: [],
    categories: [...DEFAULT_CATEGORIES],
    references: [],
  };
}

/** Serialize graph data to JSON string */
export function graphToJson(data: GraphData): string {
  return JSON.stringify(data, null, 2);
}

/** Parse JSON string to graph data */
export function jsonToGraph(json: string): GraphData {
  const data = JSON.parse(json) as GraphData;
  // Ensure version field exists
  if (!data.version) {
    data.version = CURRENT_VERSION;
  }
  // Ensure categories exist
  if (!data.categories || data.categories.length === 0) {
    data.categories = [...DEFAULT_CATEGORIES];
  }
  // Ensure all nodes have required fields
  for (const node of data.nodes) {
    if (!node.keywords) node.keywords = [];
    if (!node.referenceIds) node.referenceIds = [];
    if (node.trust === undefined) node.trust = -1;
    if (node.type === undefined) node.type = 0;
  }
  // Ensure all edges have required fields
  for (const edge of data.edges) {
    if (edge.combinedTrust === undefined) edge.combinedTrust = -1;
    if (edge.type === undefined) edge.type = 0;
  }
  // Ensure references exist
  if (!data.references) data.references = [];
  for (const ref of data.references) {
    if (!ref.authors) ref.authors = [];
    if (ref.year === undefined) ref.year = 0;
    if (!ref.publication) ref.publication = '';
    if (!ref.publisher) ref.publisher = '';
    if (!ref.citation) ref.citation = '';
    if (ref.pageStart === undefined) ref.pageStart = 0;
    if (ref.pageEnd === undefined) ref.pageEnd = 0;
    if (ref.volume === undefined) ref.volume = 0;
    if (!ref.domainTags) ref.domainTags = [];
    if (!ref.sourceApis) ref.sourceApis = [];
    if (!ref.externalIds) ref.externalIds = {};
    if (!ref.sourceAliases) ref.sourceAliases = [];
  }
  return data;
}

/**
 * Save graph data to file using the File System Access API.
 * Falls back to download if the API is not available.
 */
export async function saveGraphToFile(data: GraphData, fileHandle?: FileSystemFileHandle | null): Promise<FileSystemFileHandle | null> {
  const json = graphToJson(data);

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(json);
    await writable.close();
    return fileHandle;
  }

  // Try File System Access API
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker(opts: object): Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: 'modularpsi.json',
        types: [{ description: 'ModularPsi Graph', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return handle;
    } catch {
      // User cancelled
      return null;
    }
  }

  // Fallback: download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modularpsi.json';
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

/**
 * Load graph data from file using File System Access API.
 * Falls back to file input if the API is not available.
 */
export async function loadGraphFromFile(): Promise<{ data: GraphData; handle: FileSystemFileHandle | null } | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as unknown as { showOpenFilePicker(opts: object): Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        types: [{ description: 'ModularPsi Graph', accept: { 'application/json': ['.json'] } }],
      });
      const file = await handle.getFile();
      const text = await file.text();
      return { data: jsonToGraph(text), handle };
    } catch {
      return null;
    }
  }

  // Fallback: file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const text = await file.text();
      resolve({ data: jsonToGraph(text), handle: null });
    };
    input.click();
  });
}
