import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import type { GraphData, Reference } from '../../domain/types';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

type StudyType = NonNullable<Reference['studyType']>;
type EffectDirection = NonNullable<Reference['effectDirection']>;
type ReplicationStatus = NonNullable<Reference['replicationStatus']>;

const STUDY_TYPES: StudyType[] = ['meta-analysis', 'rct', 'observational', 'theory', 'review', 'replication'];
const EFFECT_DIRECTIONS: EffectDirection[] = ['supports', 'null', 'challenges', 'mixed'];
const REPLICATION_STATUSES: ReplicationStatus[] = ['single', 'independent-replication', 'failed-replication', 'multi-lab'];

function loadGraph(file: string): GraphData {
  return jsonToGraph(readFileSync(file, 'utf-8'));
}

function saveGraph(file: string, data: GraphData) {
  writeFileSync(file, graphToJson(data));
}

function parseList(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStudyType(value?: string): StudyType | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase() as StudyType;
  if (!STUDY_TYPES.includes(normalized)) {
    throw new Error(`Invalid studyType "${value}". Allowed: ${STUDY_TYPES.join(', ')}`);
  }
  return normalized;
}

function parseEffectDirection(value?: string): EffectDirection | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase() as EffectDirection;
  if (!EFFECT_DIRECTIONS.includes(normalized)) {
    throw new Error(`Invalid effectDirection "${value}". Allowed: ${EFFECT_DIRECTIONS.join(', ')}`);
  }
  return normalized;
}

function parseReplicationStatus(value?: string): ReplicationStatus | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase() as ReplicationStatus;
  if (!REPLICATION_STATUSES.includes(normalized)) {
    throw new Error(`Invalid replicationStatus "${value}". Allowed: ${REPLICATION_STATUSES.join(', ')}`);
  }
  return normalized;
}

function parseQualityScore(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`qualityScore must be in range [0, 1], got "${value}"`);
  }
  return parsed;
}

function generateRefId(data: GraphData): string {
  const now = Date.now();
  let n = 0;
  while (true) {
    const id = n === 0 ? `ref-${now}` : `ref-${now}-${n}`;
    if (!data.references.some((r) => r.id === id)) return id;
    n += 1;
  }
}

function findDuplicateRef(data: GraphData, candidate: Pick<Reference, 'title' | 'year' | 'doi'>): Reference | undefined {
  if (candidate.doi) {
    const byDoi = data.references.find((r) => r.doi && r.doi.toLowerCase() === candidate.doi!.toLowerCase());
    if (byDoi) return byDoi;
  }

  const normalizedTitle = candidate.title.trim().toLowerCase();
  if (!normalizedTitle) return undefined;
  return data.references.find((r) => r.title.trim().toLowerCase() === normalizedTitle && r.year === candidate.year);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  cells.push(current);
  return cells.map((c) => c.trim());
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = cells[i] ?? '';
    }
    return row;
  });
}

function buildReferenceFromFields(
  data: GraphData,
  fields: {
    id?: string;
    title: string;
    authors?: string;
    year?: string;
    publication?: string;
    publisher?: string;
    citation?: string;
    pageStart?: string;
    pageEnd?: string;
    volume?: string;
    doi?: string;
    url?: string;
    abstract?: string;
    studyType?: string;
    domainTags?: string;
    qualityScore?: string;
    effectDirection?: string;
    replicationStatus?: string;
  },
): Reference {
  return {
    id: fields.id?.trim() || generateRefId(data),
    title: fields.title.trim(),
    authors: fields.authors ? parseList(fields.authors) : [],
    year: parseNumber(fields.year ?? '', 0),
    publication: fields.publication?.trim() ?? '',
    publisher: fields.publisher?.trim() ?? '',
    citation: fields.citation?.trim() ?? '',
    pageStart: parseNumber(fields.pageStart ?? '', 0),
    pageEnd: parseNumber(fields.pageEnd ?? '', 0),
    volume: parseNumber(fields.volume ?? '', 0),
    doi: fields.doi?.trim() || undefined,
    url: fields.url?.trim() || undefined,
    abstract: fields.abstract?.trim() || undefined,
    studyType: parseStudyType(fields.studyType),
    domainTags: fields.domainTags ? parseList(fields.domainTags) : [],
    qualityScore: parseQualityScore(fields.qualityScore),
    effectDirection: parseEffectDirection(fields.effectDirection),
    replicationStatus: parseReplicationStatus(fields.replicationStatus),
  };
}

export function registerRefCommands(program: Command) {
  const ref = program.command('ref').description('Manage references');

  ref
    .command('list')
    .option('--node <id>', 'Filter by node ID')
    .description('List references')
    .action((cmdOpts: { node?: string }) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);

      if (cmdOpts.node) {
        const node = data.nodes.find((n) => n.id === cmdOpts.node);
        if (!node) {
          console.error(`Node ${cmdOpts.node} not found`);
          process.exit(1);
        }
        const nodeRefs = data.references.filter((r) => node.referenceIds.includes(r.id));
        console.log(formatOutput(nodeRefs, opts.format as OutputFormat));
      } else {
        console.log(formatOutput(data.references, opts.format as OutputFormat));
      }
    });

  ref
    .command('add')
    .requiredOption('--title <title>', 'Reference title')
    .option('--authors <authors>', 'Authors (semicolon or comma-separated)', '')
    .option('--year <year>', 'Publication year', '0')
    .option('--publication <publication>', 'Publication or journal')
    .option('--publisher <publisher>', 'Publisher')
    .option('--citation <citation>', 'Full citation')
    .option('--page-start <pageStart>', 'Start page')
    .option('--page-end <pageEnd>', 'End page')
    .option('--volume <volume>', 'Volume')
    .option('--doi <doi>', 'DOI')
    .option('--url <url>', 'URL')
    .option('--abstract <abstract>', 'Brief abstract/notes')
    .option('--study-type <studyType>', `Study type: ${STUDY_TYPES.join('|')}`)
    .option('--domain-tags <domainTags>', 'Domain tags (semicolon or comma-separated)')
    .option('--quality-score <qualityScore>', 'Quality score 0..1')
    .option('--effect-direction <effectDirection>', `Effect direction: ${EFFECT_DIRECTIONS.join('|')}`)
    .option('--replication-status <replicationStatus>', `Replication status: ${REPLICATION_STATUSES.join('|')}`)
    .description('Add a reference with rich metadata')
    .action((cmdOpts: Record<string, string>) => {
      try {
        const opts = program.opts();
        const data = loadGraph(opts.file);
        const newRef = buildReferenceFromFields(data, {
          title: cmdOpts.title,
          authors: cmdOpts.authors,
          year: cmdOpts.year,
          publication: cmdOpts.publication,
          publisher: cmdOpts.publisher,
          citation: cmdOpts.citation,
          pageStart: cmdOpts.pageStart,
          pageEnd: cmdOpts.pageEnd,
          volume: cmdOpts.volume,
          doi: cmdOpts.doi,
          url: cmdOpts.url,
          abstract: cmdOpts.abstract,
          studyType: cmdOpts.studyType,
          domainTags: cmdOpts.domainTags,
          qualityScore: cmdOpts.qualityScore,
          effectDirection: cmdOpts.effectDirection,
          replicationStatus: cmdOpts.replicationStatus,
        });

        data.references.push(newRef);
        saveGraph(opts.file, data);
        console.log(formatOutput(newRef, opts.format as OutputFormat));
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  ref
    .command('update')
    .argument('<id>', 'Reference ID')
    .option('--title <title>', 'Reference title')
    .option('--authors <authors>', 'Authors (semicolon or comma-separated)')
    .option('--year <year>', 'Publication year')
    .option('--publication <publication>', 'Publication or journal')
    .option('--publisher <publisher>', 'Publisher')
    .option('--citation <citation>', 'Full citation')
    .option('--page-start <pageStart>', 'Start page')
    .option('--page-end <pageEnd>', 'End page')
    .option('--volume <volume>', 'Volume')
    .option('--doi <doi>', 'DOI')
    .option('--url <url>', 'URL')
    .option('--abstract <abstract>', 'Brief abstract/notes')
    .option('--study-type <studyType>', `Study type: ${STUDY_TYPES.join('|')}`)
    .option('--domain-tags <domainTags>', 'Domain tags (semicolon or comma-separated)')
    .option('--quality-score <qualityScore>', 'Quality score 0..1')
    .option('--effect-direction <effectDirection>', `Effect direction: ${EFFECT_DIRECTIONS.join('|')}`)
    .option('--replication-status <replicationStatus>', `Replication status: ${REPLICATION_STATUSES.join('|')}`)
    .description('Update an existing reference')
    .action((id: string, cmdOpts: Record<string, string | undefined>) => {
      try {
        const opts = program.opts();
        const data = loadGraph(opts.file);
        const refItem = data.references.find((r) => r.id === id);
        if (!refItem) {
          console.error(`Reference ${id} not found`);
          process.exit(1);
        }

        if (cmdOpts.title !== undefined) refItem.title = cmdOpts.title.trim();
        if (cmdOpts.authors !== undefined) refItem.authors = parseList(cmdOpts.authors);
        if (cmdOpts.year !== undefined) refItem.year = parseNumber(cmdOpts.year, refItem.year);
        if (cmdOpts.publication !== undefined) refItem.publication = cmdOpts.publication.trim();
        if (cmdOpts.publisher !== undefined) refItem.publisher = cmdOpts.publisher.trim();
        if (cmdOpts.citation !== undefined) refItem.citation = cmdOpts.citation.trim();
        if (cmdOpts.pageStart !== undefined) refItem.pageStart = parseNumber(cmdOpts.pageStart, refItem.pageStart);
        if (cmdOpts.pageEnd !== undefined) refItem.pageEnd = parseNumber(cmdOpts.pageEnd, refItem.pageEnd);
        if (cmdOpts.volume !== undefined) refItem.volume = parseNumber(cmdOpts.volume, refItem.volume);
        if (cmdOpts.doi !== undefined) refItem.doi = cmdOpts.doi.trim() || undefined;
        if (cmdOpts.url !== undefined) refItem.url = cmdOpts.url.trim() || undefined;
        if (cmdOpts.abstract !== undefined) refItem.abstract = cmdOpts.abstract.trim() || undefined;
        if (cmdOpts.studyType !== undefined) refItem.studyType = parseStudyType(cmdOpts.studyType);
        if (cmdOpts.domainTags !== undefined) refItem.domainTags = parseList(cmdOpts.domainTags);
        if (cmdOpts.qualityScore !== undefined) refItem.qualityScore = parseQualityScore(cmdOpts.qualityScore);
        if (cmdOpts.effectDirection !== undefined) refItem.effectDirection = parseEffectDirection(cmdOpts.effectDirection);
        if (cmdOpts.replicationStatus !== undefined) refItem.replicationStatus = parseReplicationStatus(cmdOpts.replicationStatus);

        saveGraph(opts.file, data);
        console.log(formatOutput(refItem, opts.format as OutputFormat));
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  ref
    .command('import')
    .requiredOption('--csv <file>', 'CSV file path')
    .option('--allow-duplicates', 'Allow duplicate DOI/title+year references', false)
    .option('--dry-run', 'Parse and validate without writing', false)
    .description('Import references from CSV')
    .action((cmdOpts: { csv: string; allowDuplicates: boolean; dryRun: boolean }) => {
      try {
        const opts = program.opts();
        const data = loadGraph(opts.file);
        const rows = parseCsv(readFileSync(cmdOpts.csv, 'utf-8'));
        let imported = 0;
        let skipped = 0;
        let linked = 0;

        for (const row of rows) {
          if (!row.title || row.title.trim() === '') {
            skipped += 1;
            continue;
          }

          const refItem = buildReferenceFromFields(data, {
            id: row.id,
            title: row.title,
            authors: row.authors,
            year: row.year,
            publication: row.publication,
            publisher: row.publisher,
            citation: row.citation,
            pageStart: row.pageStart,
            pageEnd: row.pageEnd,
            volume: row.volume,
            doi: row.doi,
            url: row.url,
            abstract: row.abstract,
            studyType: row.studyType,
            domainTags: row.domainTags,
            qualityScore: row.qualityScore,
            effectDirection: row.effectDirection,
            replicationStatus: row.replicationStatus,
          });

          if (!cmdOpts.allowDuplicates && findDuplicateRef(data, { title: refItem.title, year: refItem.year, doi: refItem.doi })) {
            skipped += 1;
            continue;
          }

          if (data.references.some((r) => r.id === refItem.id)) {
            refItem.id = generateRefId(data);
          }

          data.references.push(refItem);
          imported += 1;

          const rawNodeIds = row.nodeIds ?? row.nodeids ?? '';
          if (rawNodeIds.trim() !== '') {
            for (const nodeId of parseList(rawNodeIds)) {
              const node = data.nodes.find((n) => n.id === nodeId);
              if (!node) continue;
              if (!node.referenceIds.includes(refItem.id)) {
                node.referenceIds.push(refItem.id);
                linked += 1;
              }
            }
          }
        }

        if (!cmdOpts.dryRun) {
          saveGraph(opts.file, data);
        }

        console.log(formatOutput({
          status: 'ok',
          rows: rows.length,
          imported,
          skipped,
          linksCreated: linked,
          dryRun: cmdOpts.dryRun,
        }, opts.format as OutputFormat));
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  ref
    .command('link')
    .argument('<ref-id>', 'Reference ID')
    .argument('<node-id>', 'Node ID')
    .description('Link a reference to a node')
    .action((refId: string, nodeId: string) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const node = data.nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(`Node ${nodeId} not found`);
        process.exit(1);
      }

      const refItem = data.references.find((r) => r.id === refId);
      if (!refItem) {
        console.error(`Reference ${refId} not found`);
        process.exit(1);
      }

      if (!node.referenceIds.includes(refItem.id)) {
        node.referenceIds.push(refItem.id);
      }

      saveGraph(opts.file, data);
      console.log(formatOutput({ linked: refItem.id, to: nodeId }, opts.format as OutputFormat));
    });

  ref
    .command('unlink')
    .argument('<ref-id>', 'Reference ID')
    .argument('<node-id>', 'Node ID')
    .description('Unlink a reference from a node')
    .action((refId: string, nodeId: string) => {
      const opts = program.opts();
      const data = loadGraph(opts.file);
      const node = data.nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(`Node ${nodeId} not found`);
        process.exit(1);
      }

      node.referenceIds = node.referenceIds.filter((r) => r !== refId);
      saveGraph(opts.file, data);
      console.log(formatOutput({ unlinked: refId, from: nodeId }, opts.format as OutputFormat));
    });
}
