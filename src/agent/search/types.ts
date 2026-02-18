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

export interface SearchOptions {
  query: string;
  limit?: number;
  yearMin?: number;
  yearMax?: number;
  offset?: number;
}
