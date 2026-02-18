/**
 * Legacy XML import: parse .graphml, .mpsi, and cats.mpsi files.
 * Ported from legacy/mpsilib/parsers/graphml.cpp, mpsi.cpp, cat.cpp
 *
 * Works both in browser (using DOMParser) and in Node.js (using a simple XML parser).
 */
import type { GraphData, GraphNode, GraphEdge, Category, EdgeType, NodeType, Reference } from '../domain/types';
import { DEFAULT_CATEGORIES, EDGE_TYPE_IMPLICATION } from '../domain/types';
import { propagateTrust } from '../domain/trust';

// ── Simple XML helpers (works in both browser and Node.js) ─────
// The legacy XML is simple enough that regex-based extraction works reliably.

/** Extract the text content of the first occurrence of <tagName>...</tagName> within a string */
function getTagContent(xml: string, tagName: string): string {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(re);
  return match ? match[1].trim() : '';
}

/** Extract text content of ALL occurrences of <tagName>...</tagName> */
function getAllTagContents(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = re.exec(xml)) !== null) {
    const text = match[1].trim();
    if (text) results.push(text);
  }
  return results;
}

/** Extract all blocks matching <tagName ...>...</tagName> including attributes */
function getAllBlocks(xml: string, tagName: string): Array<{ attrs: Record<string, string>; inner: string }> {
  const re = new RegExp(`<${tagName}([^>]*)>([\\s\\S]*?)</${tagName}>`, 'gi');
  const results: Array<{ attrs: Record<string, string>; inner: string }> = [];
  let match;
  while ((match = re.exec(xml)) !== null) {
    const attrStr = match[1];
    const inner = match[2];
    const attrs: Record<string, string> = {};
    const attrRe = /(\w+)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(attrStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    results.push({ attrs, inner });
  }
  return results;
}

/** Decode XML entities */
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

// ── Parse cats.mpsi ────────────────────────────────────────────

export function parseCategoriesXml(xml: string): Category[] {
  const blocks = getAllBlocks(xml, 'category');
  const categories: Category[] = [];

  for (const block of blocks) {
    const id = decodeXml(getTagContent(block.inner, 'id'));
    const name = decodeXml(getTagContent(block.inner, 'name'));
    const colorStr = getTagContent(block.inner, 'color');
    const description = decodeXml(getTagContent(block.inner, 'description'));

    // Parse "r,g,b" → "#RRGGBB"
    const parts = colorStr.split(',').map((s) => parseInt(s.trim(), 10));
    const hex =
      parts.length === 3
        ? `#${parts.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')}`
        : '#000000';

    categories.push({ id, name, color: hex, description });
  }

  return categories.length > 0 ? categories : [...DEFAULT_CATEGORIES];
}

// ── Parse prop.graphml → list of node IDs ──────────────────────

export function parseGraphmlXml(xml: string): { nodeIds: string[]; lastNodeNumber: number } {
  // Extract node IDs from <node id="P1"/> or <node id="P1">...</node>
  const nodeRe = /<node\s+id="([^"]+)"\s*\/?>/gi;
  const nodeIds: string[] = [];
  let match;
  while ((match = nodeRe.exec(xml)) !== null) {
    nodeIds.push(match[1]);
  }

  const numNodesStr = getTagContent(xml, 'numnodes');
  const lastNodeNumber = numNodesStr ? parseInt(numNodesStr, 10) : 0;

  return { nodeIds, lastNodeNumber };
}

// ── Parse individual .mpsi node file ───────────────────────────

export interface ParsedMpsiNode {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  keywords: string[];
  type: NodeType;
  referenceIds: string[];
  edges: Array<{
    id: string;
    targetId: string;
    trust: number;
    type: EdgeType;
  }>;
}

export function parseMpsiNodeXml(xml: string): ParsedMpsiNode {
  const mpsiContent = getTagContent(xml, 'mpsi');
  if (!mpsiContent) throw new Error('Invalid .mpsi file: no <mpsi> root element');

  const id = decodeXml(getTagContent(mpsiContent, 'id'));
  const name = decodeXml(getTagContent(mpsiContent, 'name'));
  const description = decodeXml(getTagContent(mpsiContent, 'description'));
  const categoryId = getTagContent(mpsiContent, 'category');
  const keywordsStr = decodeXml(getTagContent(mpsiContent, 'keywords'));
  const keywords = keywordsStr ? keywordsStr.split(';').map((k) => k.trim()).filter(Boolean) : [];
  const modeStr = getTagContent(mpsiContent, 'mode');
  const type = (modeStr ? parseInt(modeStr, 10) : 0) as NodeType;
  const referenceIds = getAllTagContents(mpsiContent, 'reference');

  // Parse edges
  const edgeBlocks = getAllBlocks(mpsiContent, 'edge');
  const edges: ParsedMpsiNode['edges'] = [];
  for (const block of edgeBlocks) {
    const edgeId = block.attrs['id'] ?? '';
    const targetId = block.attrs['target'] ?? '';
    const trustStr = getTagContent(block.inner, 'trust');
    const trust = trustStr ? parseFloat(trustStr) : -1;
    const typeStr = getTagContent(block.inner, 'type');
    const edgeType = (typeStr ? parseInt(typeStr, 10) : EDGE_TYPE_IMPLICATION) as EdgeType;
    edges.push({ id: edgeId, targetId, trust, type: edgeType });
  }

  return { id, name, description, categoryId, keywords, type, referenceIds, edges };
}

// ── Parse .xsql files (legacy SQL dump format) ────────────────

/** Parse an xsql file into rows of [a, b, c, ...] values */
function parseXsql(xml: string): Array<Record<string, string>> {
  const blocks = getAllBlocks(xml, 'ins');
  return blocks.map((block) => {
    const row: Record<string, string> = {};
    // Extract single-letter tags <a>...</a> through <p>...</p>
    for (const tag of 'abcdefghijklmnop'.split('')) {
      const val = getTagContent(block.inner, tag);
      if (val !== undefined) row[tag] = decodeXml(val);
    }
    return row;
  });
}

/** Parse legacy xsql reference files into Reference objects */
function parseLegacyReferences(files: Map<string, string>): Reference[] {
  const refsXml = files.get('table_refs.xsql');
  if (!refsXml) return [];

  const authorsXml = files.get('table_authors.xsql');
  const autrefXml = files.get('table_autref.xsql');
  const pubsXml = files.get('table_pubs.xsql');
  const publisherXml = files.get('table_publisher.xsql');

  // Build lookup maps
  const authorMap = new Map<string, string>(); // id → name
  if (authorsXml) {
    for (const row of parseXsql(authorsXml)) {
      authorMap.set(row.a, row.b);
    }
  }

  const pubMap = new Map<string, string>(); // id → name
  if (pubsXml) {
    for (const row of parseXsql(pubsXml)) {
      pubMap.set(row.a, row.b);
    }
  }

  const publisherMap = new Map<string, string>(); // id → name
  if (publisherXml) {
    for (const row of parseXsql(publisherXml)) {
      publisherMap.set(row.a, row.b);
    }
  }

  // Build ref → author mapping
  const refAuthors = new Map<string, string[]>(); // refId → [authorName, ...]
  if (autrefXml) {
    for (const row of parseXsql(autrefXml)) {
      const authorId = row.a;
      const refId = row.b;
      const authorName = authorMap.get(authorId) ?? authorId;
      const list = refAuthors.get(refId) ?? [];
      if (!list.includes(authorName)) list.push(authorName);
      refAuthors.set(refId, list);
    }
  }

  // Parse refs: columns are a=rid, b=rtitle, c=cid, d=pid, e=tid, f=lid,
  // g=pbid, h=ryear, i=rabstract, j=rtext, k=rfile, l=rpgstar, m=rpgend,
  // n=rref (citation), o=red (edition), p=rvol
  const refs: Reference[] = [];
  for (const row of parseXsql(refsXml)) {
    refs.push({
      id: row.a,
      title: row.b ?? '',
      authors: refAuthors.get(row.a) ?? [],
      year: parseInt(row.h) || 0,
      publication: pubMap.get(row.d) ?? '',
      publisher: publisherMap.get(row.g) ?? '',
      citation: row.n ?? '',
      pageStart: parseInt(row.l) || 0,
      pageEnd: parseInt(row.m) || 0,
      volume: parseInt(row.p) || 0,
      description: row.i ?? '',
      doi: '',
      url: '',
      semanticScholarId: '',
      openAlexId: '',
      abstract: '',
    });
  }

  return refs;
}

// ── Import complete legacy directory ───────────────────────────

/**
 * Import a legacy ModularPsi data directory.
 * Takes a map of filename → file contents (to work in both browser and Node.js).
 */
export function importLegacyData(files: Map<string, string>): GraphData {
  // 1. Parse categories
  const catsXml = files.get('cats.mpsi') ?? '';
  const categories = catsXml ? parseCategoriesXml(catsXml) : [...DEFAULT_CATEGORIES];

  // 2. Parse graphml to get node list
  const graphmlXml = files.get('prop.graphml') ?? files.get('model.graphml') ?? '';
  if (!graphmlXml) throw new Error('No prop.graphml or model.graphml found');
  const { nodeIds, lastNodeNumber } = parseGraphmlXml(graphmlXml);

  // Determine prefix from first node ID
  const prefix = nodeIds[0]?.[0] === 'M' ? 'M' : 'P';

  // 3. Parse each node's .mpsi file
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const nodeId of nodeIds) {
    const mpsiXml = files.get(`${nodeId}.mpsi`);
    if (!mpsiXml) {
      // Node declared in graphml but no .mpsi file — create stub
      nodes.push({
        id: nodeId,
        name: nodeId,
        description: '',
        categoryId: 'general',
        keywords: [],
        type: 0,
        trust: -1,
        referenceIds: [],
      });
      continue;
    }

    const parsed = parseMpsiNodeXml(mpsiXml);
    nodes.push({
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      categoryId: parsed.categoryId,
      keywords: parsed.keywords,
      type: parsed.type,
      trust: -1, // will be computed by propagateTrust
      referenceIds: parsed.referenceIds,
    });

    for (const edge of parsed.edges) {
      // Avoid duplicates (edges are stored per-source node)
      if (!seenEdges.has(edge.id)) {
        seenEdges.add(edge.id);
        edges.push({
          id: edge.id,
          sourceId: parsed.id,
          targetId: edge.targetId,
          trust: edge.trust,
          type: edge.type,
          combinedTrust: -1,
        });
      }
    }
  }

  // 4. Parse references from xsql files
  const references = parseLegacyReferences(files);

  // 5. Determine root: node with no incoming edges
  const nodesWithIncoming = new Set(edges.map((e) => e.targetId));
  const rootId = nodes.find((n) => !nodesWithIncoming.has(n.id))?.id ?? `${prefix}1`;

  // 6. Propagate trust
  const propagated = propagateTrust(nodes, edges, rootId);

  return {
    version: 1,
    prefix: prefix as 'P' | 'M',
    rootId,
    lastNodeNumber,
    nodes: propagated.nodes,
    edges: propagated.edges,
    categories,
    references,
  };
}
