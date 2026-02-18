import { Command } from 'commander';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import type { GraphData, GraphNode } from '../../domain/types';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';
import { compactTimestamp, DEFAULT_VAULT, resolveVaultPath, todayIsoDate } from '../vault';
import { dedupeDiscoveredWorks, mapWorkToNode, parseOpenAlexAbstract, workToReference } from '../discovery';
import type { DiscoveredWork } from '../discovery';
import { rankHypotheses } from '../evidence';

function loadGraph(file: string): GraphData {
  return jsonToGraph(readFileSync(file, 'utf-8'));
}

function saveGraph(file: string, data: GraphData) {
  writeFileSync(file, graphToJson(data));
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function normalizeQuery(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildQueries(nodes: GraphNode[], maxQueries: number): string[] {
  const sorted = [...nodes]
    .filter((n) => n.name.trim() !== '')
    .sort((a, b) => b.trust - a.trust || b.referenceIds.length - a.referenceIds.length);

  const queries: string[] = [];
  for (const node of sorted) {
    if (queries.length >= maxQueries) break;
    queries.push(normalizeQuery(node.name));
    if (node.keywords.length > 0 && queries.length < maxQueries) {
      queries.push(normalizeQuery(`${node.name} ${node.keywords.slice(0, 3).join(' ')}`));
    }
  }

  return [...new Set(queries)].slice(0, maxQueries);
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function harvestOpenAlex(query: string, limit: number): Promise<DiscoveredWork[]> {
  type OpenAlexResponse = {
    results: Array<{
      id?: string;
      doi?: string;
      display_name: string;
      publication_year?: number;
      abstract_inverted_index?: Record<string, number[]>;
      authorships?: Array<{ author?: { display_name?: string } }>;
      primary_location?: { landing_page_url?: string };
      cited_by_count?: number;
    }>;
  };
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
  const payload = await getJson<OpenAlexResponse>(url);
  if (!payload?.results) return [];

  return payload.results.map((item) => ({
    title: item.display_name ?? '',
    authors: (item.authorships ?? []).map((a) => a.author?.display_name ?? '').filter(Boolean),
    year: item.publication_year ?? 0,
    abstract: parseOpenAlexAbstract(item.abstract_inverted_index),
    doi: item.doi,
    url: item.primary_location?.landing_page_url,
    sourceApis: ['openalex'],
    externalIds: { openAlex: item.id, doi: item.doi },
    citationCount: item.cited_by_count ?? 0,
  })).filter((w) => w.title.trim() !== '');
}

async function harvestSemanticScholar(query: string, limit: number): Promise<DiscoveredWork[]> {
  type SemanticResponse = {
    data: Array<{
      paperId?: string;
      title?: string;
      year?: number;
      abstract?: string;
      url?: string;
      authors?: Array<{ name?: string }>;
      externalIds?: { DOI?: string; ArXiv?: string };
      citationCount?: number;
    }>;
  };
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,year,abstract,url,authors,externalIds,citationCount`;
  const payload = await getJson<SemanticResponse>(url);
  if (!payload?.data) return [];

  return payload.data.map((item) => ({
    title: item.title ?? '',
    authors: (item.authors ?? []).map((a) => a.name ?? '').filter(Boolean),
    year: item.year ?? 0,
    abstract: item.abstract,
    doi: item.externalIds?.DOI,
    url: item.url,
    sourceApis: ['semanticscholar'],
    externalIds: { semanticScholar: item.paperId, doi: item.externalIds?.DOI, arxiv: item.externalIds?.ArXiv },
    citationCount: item.citationCount ?? 0,
  })).filter((w) => w.title.trim() !== '');
}

async function harvestCrossRef(query: string, limit: number): Promise<DiscoveredWork[]> {
  type CrossrefResponse = {
    message?: {
      items?: Array<{
        DOI?: string;
        title?: string[];
        issued?: { 'date-parts'?: number[][] };
        author?: Array<{ given?: string; family?: string; name?: string }>;
        URL?: string;
        abstract?: string;
      }>;
    };
  };
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`;
  const payload = await getJson<CrossrefResponse>(url, {
    headers: {
      'User-Agent': 'modularpsi-discovery/1.0 (mailto:modularpsi@example.org)',
    },
  });
  const items = payload?.message?.items ?? [];
  return items.map((item) => {
    const year = item.issued?.['date-parts']?.[0]?.[0] ?? 0;
    const authors = (item.author ?? []).map((a) => a.name ?? `${a.given ?? ''} ${a.family ?? ''}`.trim()).filter(Boolean);
    return {
      title: item.title?.[0] ?? '',
      authors,
      year,
      abstract: item.abstract?.replace(/<[^>]*>/g, ' '),
      doi: item.DOI,
      url: item.URL,
      sourceApis: ['crossref'],
      externalIds: { doi: item.DOI },
    } as DiscoveredWork;
  }).filter((w) => w.title.trim() !== '');
}

function extractTagValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
  }
  return values;
}

async function harvestArxiv(query: string, limit: number): Promise<DiscoveredWork[]> {
  try {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const xml = await response.text();
    const entries = xml.split('<entry>').slice(1).map((e) => `<entry>${e}`);
    return entries.map((entry) => {
      const title = extractTagValues(entry, 'title')[0] ?? '';
      const summary = extractTagValues(entry, 'summary')[0] ?? '';
      const id = extractTagValues(entry, 'id')[0] ?? '';
      const published = extractTagValues(entry, 'published')[0] ?? '';
      const year = published ? Number.parseInt(published.slice(0, 4), 10) : 0;
      const authors = extractTagValues(entry, 'name');
      const arxivId = id.includes('arxiv.org/abs/') ? id.split('arxiv.org/abs/')[1] : undefined;
      return {
        title,
        authors,
        year: Number.isFinite(year) ? year : 0,
        abstract: summary,
        doi: undefined,
        url: id,
        sourceApis: ['arxiv'],
        externalIds: { arxiv: arxivId },
      } as DiscoveredWork;
    }).filter((w) => w.title.trim() !== '');
  } catch {
    return [];
  }
}

async function harvestAllSources(query: string, perSource: number): Promise<DiscoveredWork[]> {
  const [oa, ss, cr, ax] = await Promise.all([
    harvestOpenAlex(query, perSource),
    harvestSemanticScholar(query, perSource),
    harvestCrossRef(query, perSource),
    harvestArxiv(query, perSource),
  ]);
  return [...oa, ...ss, ...cr, ...ax];
}

function generateRefId(data: GraphData): string {
  const base = `ref-${Date.now()}`;
  let n = 0;
  while (true) {
    const id = n === 0 ? base : `${base}-${n}`;
    if (!data.references.some((r) => r.id === id)) return id;
    n += 1;
  }
}

function hasDuplicateReference(data: GraphData, work: DiscoveredWork): boolean {
  const doi = work.doi?.toLowerCase();
  const title = work.title.trim().toLowerCase();
  return data.references.some((ref) => {
    if (doi && ref.doi?.toLowerCase() === doi) return true;
    return ref.title.trim().toLowerCase() === title && ref.year === work.year;
  });
}

function buildBriefMarkdown(data: GraphData, top = 10): string {
  const ranked = rankHypotheses(data).slice(0, top);
  const refById = new Map(data.references.map((r) => [r.id, r]));
  const lines: string[] = ['# Discovery Brief', ''];
  for (const item of ranked) {
    lines.push(`## ${item.id} — ${item.name}`);
    if (item.description.trim()) lines.push(`- ${item.description}`);
    lines.push(`- Trust: ${item.trust.toFixed(2)} | Rank: ${item.rankScore.toFixed(2)} | Evidence: ${item.evidenceCount}`);
    const refs = item.references.slice(0, 3);
    for (const ref of refs) {
      const url = ref.url ?? (ref.doi ? `https://doi.org/${ref.doi}` : '');
      const summary = ref.aiSummary || ref.abstract || ref.citation || '';
      lines.push(`- **${ref.title}** (${ref.year})${url ? ` — ${url}` : ''}`);
      if (summary) lines.push(`  ${summary.slice(0, 220)}`);
    }
    if (refs.length === 0) {
      const fallbackRefs = (data.nodes.find((n) => n.id === item.id)?.referenceIds ?? [])
        .map((id) => refById.get(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .slice(0, 1);
      for (const ref of fallbackRefs) {
        lines.push(`- **${ref.title}** (${ref.year})`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function registerDiscoverCommands(program: Command) {
  const discover = program.command('discover').description('AI-driven literature discovery using free/open APIs');

  discover
    .command('run')
    .option('--vault <path>', `Vault base folder (default: ${DEFAULT_VAULT})`)
    .option('--date <yyyy-mm-dd>', 'Run date', todayIsoDate())
    .option('--max-queries <n>', 'Maximum auto-generated queries', '12')
    .option('--per-source <n>', 'Max results per query per source', '5')
    .option('--min-map-confidence <n>', 'Minimum confidence to auto-link', '0.14')
    .option('--max-new-refs <n>', 'Maximum new references to apply', '150')
    .option('--max-new-nodes <n>', 'Maximum new nodes to allow in one run (guard rail)', '20')
    .option('--max-trust-delta <n>', 'Maximum allowed trust delta in one run', '0.35')
    .option('--strict', 'Enable strict validation checks', true)
    .option('--no-strict', 'Disable strict validation checks')
    .option('--dry-run', 'Do not write changes to graph', false)
    .description('Run discovery + mapping + audit + optional apply')
    .action(async (cmdOpts: {
      vault?: string;
      date: string;
      maxQueries: string;
      perSource: string;
      minMapConfidence: string;
      maxNewRefs: string;
      maxNewNodes: string;
      maxTrustDelta: string;
      strict: boolean;
      dryRun: boolean;
    }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const beforeTrustByNode = new Map(data.nodes.map((n) => [n.id, n.trust]));
      const vault = resolveVaultPath(cmdOpts.vault);
      const runRoot = join(vault, 'runs', cmdOpts.date);
      const snapshotsDir = join(vault, 'snapshots');
      ensureDir(runRoot);
      ensureDir(snapshotsDir);

      const maxQueries = Math.max(1, Number.parseInt(cmdOpts.maxQueries, 10) || 12);
      const perSource = Math.max(1, Number.parseInt(cmdOpts.perSource, 10) || 5);
      const minMapConfidence = Math.max(0, Math.min(1, Number.parseFloat(cmdOpts.minMapConfidence) || 0.14));
      const maxNewRefs = Math.max(1, Number.parseInt(cmdOpts.maxNewRefs, 10) || 150);
      const maxNewNodes = Math.max(0, Number.parseInt(cmdOpts.maxNewNodes, 10) || 20);
      const maxTrustDelta = Math.max(0, Number.parseFloat(cmdOpts.maxTrustDelta) || 0.35);

      const queries = buildQueries(data.nodes, maxQueries);
      const harvested: DiscoveredWork[] = [];
      for (const q of queries) {
        const works = await harvestAllSources(q, perSource);
        harvested.push(...works);
      }

      const deduped = dedupeDiscoveredWorks(harvested);
      const candidates = deduped.map((work) => {
        const mapping = mapWorkToNode(work, data.nodes);
        return { work, mapping };
      });

      const rejected: Array<{ title: string; reason: string }> = [];
      const accepted = candidates
        .filter((c) => {
          if (!c.mapping.nodeId || c.mapping.confidence < minMapConfidence) {
            rejected.push({ title: c.work.title, reason: 'low-map-confidence' });
            return false;
          }
          return true;
        })
        .filter((c) => {
          if (hasDuplicateReference(data, c.work)) {
            rejected.push({ title: c.work.title, reason: 'duplicate' });
            return false;
          }
          return true;
        })
        .filter((c) => {
          if (!cmdOpts.strict) return true;
          if (c.work.title.trim() === '') {
            rejected.push({ title: c.work.title, reason: 'missing-title' });
            return false;
          }
          if (!c.work.year || c.work.year <= 0) {
            rejected.push({ title: c.work.title, reason: 'missing-year' });
            return false;
          }
          if (!c.work.doi && !c.work.url) {
            rejected.push({ title: c.work.title, reason: 'missing-doi-url' });
            return false;
          }
          const node = data.nodes.find((n) => n.id === c.mapping.nodeId);
          if (!node) {
            rejected.push({ title: c.work.title, reason: 'missing-target-node' });
            return false;
          }
          if (node.description.trim() === '') {
            rejected.push({ title: c.work.title, reason: 'target-node-empty-description' });
            return false;
          }
          return true;
        })
        .slice(0, maxNewRefs);

      const skipped = candidates.length - accepted.length;
      const auditPath = join(runRoot, 'audit.jsonl');
      const candidatesPath = join(runRoot, 'discovery-candidates.json');
      const appliedPath = join(runRoot, 'discovery-applied.json');
      const rankPath = join(runRoot, 'hypothesis-rank.json');
      const briefPath = join(runRoot, 'evidence-brief.md');
      const snapshotName = `psi-map-${compactTimestamp()}.json`;
      const snapshotPath = join(snapshotsDir, snapshotName);

      writeFileSync(candidatesPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        graphFile: opts.file,
        queries,
        harvestedCount: harvested.length,
        dedupedCount: deduped.length,
        candidates: candidates.map((c) => ({
          title: c.work.title,
          year: c.work.year,
          doi: c.work.doi,
          url: c.work.url,
          sourceApis: c.work.sourceApis,
          mapping: c.mapping,
        })),
        rejected,
      }, null, 2));

      copyFileSync(opts.file, snapshotPath);

      const applied: Array<{ refId: string; nodeId: string; title: string; mappingConfidence: number }> = [];
      const proposedNewNodes = 0;
      if (proposedNewNodes > maxNewNodes) {
        console.error(`Run blocked: proposed new nodes ${proposedNewNodes} exceeds max-new-nodes ${maxNewNodes}`);
        process.exit(1);
      }

      if (!cmdOpts.dryRun) {
        for (const item of accepted) {
          const refId = generateRefId(data);
          const ref = workToReference(item.work, refId, item.mapping.confidence);
          data.references.push(ref);
          const node = data.nodes.find((n) => n.id === item.mapping.nodeId);
          if (!node) continue;
          if (!node.referenceIds.includes(refId)) {
            node.referenceIds.push(refId);
          }
          applied.push({ refId, nodeId: node.id, title: ref.title, mappingConfidence: item.mapping.confidence });
          appendFileSync(auditPath, JSON.stringify({
            ts: new Date().toISOString(),
            action: 'reference.add-link',
            refId,
            nodeId: node.id,
            title: ref.title,
            mappingConfidence: item.mapping.confidence,
            sourceApis: ref.sourceApis,
          }) + '\n');
        }
        let maxObservedTrustDelta = 0;
        for (const node of data.nodes) {
          const prev = beforeTrustByNode.get(node.id);
          if (prev === undefined) continue;
          const delta = Math.abs(node.trust - prev);
          if (delta > maxObservedTrustDelta) maxObservedTrustDelta = delta;
        }
        if (cmdOpts.strict && maxObservedTrustDelta > maxTrustDelta) {
          console.error(`Run blocked: max trust delta ${maxObservedTrustDelta.toFixed(3)} exceeds threshold ${maxTrustDelta.toFixed(3)}`);
          process.exit(1);
        }
        saveGraph(opts.file, data);
      }

      const rank = rankHypotheses(data).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        rankScore: r.rankScore,
        trust: r.trust,
        evidenceCount: r.evidenceCount,
      }));
      writeFileSync(rankPath, JSON.stringify(rank, null, 2));
      writeFileSync(briefPath, buildBriefMarkdown(data));

      writeFileSync(appliedPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        dryRun: cmdOpts.dryRun,
        snapshotPath,
        acceptedCount: accepted.length,
        appliedCount: applied.length,
        rejectedCount: rejected.length,
        rejected,
        applied,
      }, null, 2));

      appendFileSync(auditPath, JSON.stringify({
        ts: new Date().toISOString(),
        action: 'discover.run',
        graphFile: opts.file,
        snapshotPath,
        queriesCount: queries.length,
        harvestedCount: harvested.length,
        dedupedCount: deduped.length,
        acceptedCount: accepted.length,
        appliedCount: applied.length,
        skippedCount: skipped,
        rejectedCount: rejected.length,
        strict: cmdOpts.strict,
        maxNewNodes,
        maxTrustDelta,
        dryRun: cmdOpts.dryRun,
        minMapConfidence,
      }) + '\n');

      console.log(formatOutput({
        status: 'ok',
        vault,
        runRoot,
        snapshotPath,
        queries: queries.length,
        harvested: harvested.length,
        deduped: deduped.length,
        accepted: accepted.length,
        applied: applied.length,
        rejected: rejected.length,
        skipped,
        dryRun: cmdOpts.dryRun,
        artifacts: { candidatesPath, appliedPath, auditPath, rankPath, briefPath },
      }, opts.format as OutputFormat));
    });
}
