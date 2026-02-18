import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface RunNoteInput {
  runId: string;
  date: string;
  queries: string[];
  discoverySummary: {
    totalEvents: number;
    totalCandidates: number;
    byDecision: Record<string, number>;
  };
  importedDraftRefs: number;
  topHypotheses: Array<{ id: string; statement: string; score: number; status: string }>;
  rejectedNearMisses: Array<{ candidateId: string; reason?: string; title: string }>;
}

export function buildRunNoteMarkdown(input: RunNoteInput): string {
  const lines: string[] = [
    `# Agent Run ${input.runId}`,
    '',
    `Date: ${input.date}`,
    '',
    '## Queries Run',
    ...(input.queries.length > 0 ? input.queries.map((q) => `- ${q}`) : ['- (none)']),
    '',
    '## Explored Counts',
    `- events: ${input.discoverySummary.totalEvents}`,
    `- candidates: ${input.discoverySummary.totalCandidates}`,
    ...Object.entries(input.discoverySummary.byDecision).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Imported Drafts',
    `- references: ${input.importedDraftRefs}`,
    '',
    '## Proposed Hypotheses',
    ...(input.topHypotheses.length > 0
      ? input.topHypotheses.map((h) => `- ${h.id} (${h.score.toFixed(2)}, ${h.status}): ${h.statement}`)
      : ['- (none)']),
    '',
    '## Constraints Discovered',
    '- Add constraint edges as reviewed (`requires`, `confounded-by`, `incompatible-with`, `fails-when`).',
    '',
    '## Rejected Near-Misses',
    ...(input.rejectedNearMisses.length > 0
      ? input.rejectedNearMisses.map((r) => `- ${r.candidateId}: ${r.title}${r.reason ? ` (${r.reason})` : ''}`)
      : ['- (none)']),
    '',
    '## Next-Run Seeds',
    '- Expand on highest-trust nodes lacking references.',
    '- Revisit deferred/rejected candidates with updated queries.',
    '',
  ];

  return lines.join('\n');
}

export function writeRunNote(vaultPath: string, input: RunNoteInput): { filePath: string; content: string } {
  const dir = join(vaultPath, 'agent-runs');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${input.date}-${input.runId}.md`);
  const content = buildRunNoteMarkdown(input);
  writeFileSync(filePath, content);
  return { filePath, content };
}
