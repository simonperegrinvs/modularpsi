import type { GraphData, Reference } from '../domain/types';
import type { AgentConfig } from './config';
import type { AgentState } from './state';
import type { ApiSource } from './search';
import type { LiteratureSearchResult, SearchOptions } from './search';
import {
  createDiscoveryEventFromSearchResult,
  writeDiscoveryEvent,
} from './discovery';

function uniq(items: string[]): string[] {
  return [...new Set(items.map((x) => x.trim()).filter(Boolean))];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildDiscoveryQueries(
  data: GraphData,
  config: AgentConfig,
  maxQueries: number,
): string[] {
  const candidates = data.nodes
    .filter((n) => n.id !== data.rootId)
    .filter((n) => n.referenceIds.length === 0 || n.trust < 0)
    .sort((a, b) => b.trust - a.trust)
    .map((n) => {
      const kw = n.keywords.slice(0, 5).join(' ');
      return kw ? `${n.name} ${kw}` : n.name;
    });

  const frontier = (config.focusKeywords ?? [])
    .filter((kw) => !(config.excludeKeywords ?? []).includes(kw))
    .map((kw) => `${kw} psi`);

  return uniq([...candidates, ...frontier]).slice(0, Math.max(0, maxQueries));
}

export interface DiscoveryIngestOptions {
  baseDir: string;
  data: GraphData;
  references: Reference[];
  config: AgentConfig;
  state: AgentState;
  searchFn: (opts: SearchOptions & { api?: ApiSource }) => Promise<LiteratureSearchResult[]>;
  citationFn?: (
    doi: string,
    direction: 'citing' | 'cited-by',
    limit: number,
  ) => Promise<LiteratureSearchResult[]>;
  runId?: string;
  queries?: string[];
  apis?: ApiSource[];
  limit?: number;
  yearMin?: number;
  yearMax?: number;
  maxQueries?: number;
}

export interface DiscoveryIngestResult {
  runId: string;
  queries: string[];
  apis: ApiSource[];
  totalResults: number;
  citationAnchorCount: number;
  citationResults: number;
  eventsWritten: number;
  byDecision: Record<'queued' | 'parsed' | 'imported-draft' | 'duplicate' | 'rejected' | 'deferred', number>;
  nextState: AgentState;
}

export async function runDiscoveryIngestion(opts: DiscoveryIngestOptions): Promise<DiscoveryIngestResult> {
  const runId = opts.runId ?? `discovery-${Date.now()}`;
  const maxQueries = opts.maxQueries ?? opts.config.maxQueriesPerRun;
  const queries = (opts.queries && opts.queries.length > 0)
    ? uniq(opts.queries).slice(0, Math.max(0, maxQueries))
    : buildDiscoveryQueries(opts.data, opts.config, maxQueries);
  const apis = (opts.apis && opts.apis.length > 0)
    ? opts.apis
    : (opts.config.searchApis as ApiSource[]);
  const limit = opts.limit ?? opts.config.maxResultsPerQuery;
  const processedIds = new Set(opts.state.processedCandidateIds ?? []);
  const recentQueries = [...(opts.state.recentSearchQueries ?? [])];

  const byDecision = {
    queued: 0,
    parsed: 0,
    'imported-draft': 0,
    duplicate: 0,
    rejected: 0,
    deferred: 0,
  } as const;
  const byDecisionMutable = { ...byDecision };

  let totalResults = 0;
  let citationResults = 0;
  let eventsWritten = 0;

  for (const query of queries) {
    recentQueries.push(query);
    for (const api of apis) {
      const results = await opts.searchFn({
        query,
        api,
        limit,
        yearMin: opts.yearMin,
        yearMax: opts.yearMax,
      });
      totalResults += results.length;

      for (const result of results) {
        const event = createDiscoveryEventFromSearchResult(
          result,
          query,
          runId,
          opts.references,
        );

        if (processedIds.has(event.candidateId)) {
          event.decision = 'duplicate';
          event.decisionReason = 'already-processed-candidate-id';
          event.action = 'decision-update';
        } else {
          processedIds.add(event.candidateId);
        }

        byDecisionMutable[event.decision]++;
        writeDiscoveryEvent(opts.baseDir, event);
        eventsWritten++;
      }

      if (opts.config.rateLimitMs > 0) {
        await sleep(opts.config.rateLimitMs);
      }
    }
  }

  // Citation snowball lane: anchored on existing DOI references
  const citationAnchors = opts.references
    .filter((r) => !!r.doi)
    .slice(0, Math.max(0, opts.config.citationSnowballsPerRun));

  if (opts.citationFn) {
    for (const ref of citationAnchors) {
      const citeResults = await opts.citationFn(ref.doi, 'citing', limit);
      citationResults += citeResults.length;
      totalResults += citeResults.length;
      const citationQuery = `citations:citing:${ref.doi}`;
      recentQueries.push(citationQuery);

      for (const result of citeResults) {
        const event = createDiscoveryEventFromSearchResult(
          result,
          citationQuery,
          runId,
          opts.references,
        );

        if (processedIds.has(event.candidateId)) {
          event.decision = 'duplicate';
          event.decisionReason = 'already-processed-candidate-id';
          event.action = 'decision-update';
        } else {
          processedIds.add(event.candidateId);
        }

        byDecisionMutable[event.decision]++;
        writeDiscoveryEvent(opts.baseDir, event);
        eventsWritten++;
      }

      if (opts.config.rateLimitMs > 0) {
        await sleep(opts.config.rateLimitMs);
      }
    }
  }

  const now = new Date().toISOString();
  const previousStats = opts.state.discoveryStats ?? {
    queued: 0,
    parsed: 0,
    imported: 0,
    duplicate: 0,
    rejected: 0,
  };
  const nextState: AgentState = {
    ...opts.state,
    lastRunTimestamp: now,
    lastRunId: runId,
    totalRuns: (opts.state.totalRuns ?? 0) + 1,
    recentSearchQueries: recentQueries.slice(-200),
    processedCandidateIds: [...processedIds].slice(-5000),
    lastDiscoveryRunId: runId,
    discoveryStats: {
      queued: previousStats.queued + byDecisionMutable.queued,
      parsed: previousStats.parsed + byDecisionMutable.parsed,
      imported: previousStats.imported + byDecisionMutable['imported-draft'],
      duplicate: previousStats.duplicate + byDecisionMutable.duplicate,
      rejected: previousStats.rejected + byDecisionMutable.rejected,
    },
  };

  return {
    runId,
    queries,
    apis,
    totalResults,
    citationAnchorCount: citationAnchors.length,
    citationResults,
    eventsWritten,
    byDecision: byDecisionMutable,
    nextState,
  };
}
