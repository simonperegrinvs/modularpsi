export interface LiteratureSearchResult {
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  abstract?: string;
  url?: string;
  semanticScholarId?: string;
  openAlexId?: string;
  citationCount?: number;
  source: 'semantic-scholar' | 'openalex' | 'crossref' | 'arxiv';
}

export type DiscoveryDecision =
  | 'queued'
  | 'parsed'
  | 'imported-draft'
  | 'duplicate'
  | 'rejected'
  | 'deferred';

export interface DiscoveryCandidate {
  candidateId: string;
  source: LiteratureSearchResult['source'];
  discoveredAt: string;
  query: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  abstract?: string;
  abstractChecksum?: string;
  url?: string;
  semanticScholarId?: string;
  openAlexId?: string;
  classification?: 'in-scope-core' | 'in-scope-adjacent' | 'out-of-scope';
  decision: DiscoveryDecision;
  decisionReason?: string;
  linkedNodeIds?: string[];
  runId: string;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  yearMin?: number;
  yearMax?: number;
  offset?: number;
}
