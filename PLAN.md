# Plan: Psi Literature Knowledge Graph with Continuous AI-Driven Scanning

_Merged from PLAN.md (implementation details) and CONSOLIDATED_PLAN.md (governance, visualization, operational design)._

## Context

Build a comprehensive knowledge graph mapping scientific literature on psi phenomena using ModularPsi's CLI, then keep it alive with continuous AI-driven literature scanning. The current `modularpsi.json` has ~40 nodes from a 2004-era dataset. We'll create a fresh graph with a cleaner taxonomy, richer references, and modern literature — then automate its growth with governance controls.

**All literature APIs are completely free** — Semantic Scholar, OpenAlex, CrossRef, arXiv. No journal subscriptions needed.

### Decisions

- **Agent runner**: Claude Code CLI (`claude -p "..."`) in a cron job — uses existing subscription, no API key needed
- **Obsidian vault**: Direct file writes (no external CLI dependency)
- **Cadence**: Daily incremental scans
- **Publish mode**: Auto-publish with audit trail (all agent content starts as `draft`)
- **Visualization**: Layered clusters with filters
- **Execution**: Phase by phase with review between phases

### Phases

1. **Phase A** — Code changes (Steps 1, 9, 10, 11) — extend types, CLI, batch ops, governance
2. **Phase B** — Build initial graph (Steps 2-8) — seed content via CLI
3. **Phase C** — Literature search + agent (Steps 12, 13) — external APIs, discovery loop, audit
4. **Phase D** — Obsidian vault sync + visualization (Steps 14, 15) — vault, cluster UI, filters

---

## Step 1: Interface Improvements (Code Changes)

The `Reference` type (`src/domain/types.ts:121-132`) lacks a `description` field. The `ref add` CLI (`src/cli/commands/ref.ts:30-57`) is missing several useful options. The `node add` CLI (`src/cli/commands/node.ts:57-104`) lacks `--description` and `--keywords`.

**1a. Add `description` to Reference type**
- File: `src/domain/types.ts` — add `description: string` to `Reference` interface

**1b. Backfill in JSON loader**
- File: `src/io/json-io.ts` — loop to set `ref.description = ''` if missing

**1c. Extend `ref add` CLI**
- File: `src/cli/commands/ref.ts` — add `--description`, `--journal`, `--citation` options

**1d. Add `ref update` subcommand**
- File: `src/cli/commands/ref.ts` — update any reference field by ID (follow `category update` pattern in `category.ts:46-68`)

**1e. Extend `node add` CLI**
- File: `src/cli/commands/node.ts` — add `--description`, `--keywords` to `add` command
- Add `--require-description` validation mode to fail on empty descriptions

**1f. Update UI components**
- `src/components/references/ReferenceDialog.tsx` — description textarea
- `src/components/references/ReferenceList.tsx` — display description
- Show warning badge for nodes with empty description
- Add metadata completeness indicator per node (description, keywords, references linked)

**1g. Update legacy import**
- File: `src/io/legacy-import.ts` — map `rabstract` → `description`, default `''`

**1h. Run tests** — fix any breakage from the new field

---

## Step 2: Initialize Fresh Graph

```bash
npm run mpsi -- init --file psi-literature.json
npm run mpsi -- -f psi-literature.json node update P1 --name "Psi Phenomena" \
  --description "Root: comprehensive assessment of hypotheses about anomalous cognition and interaction"
```

---

## Step 3: Set Up Categories (10 categories)

Replace the default 6 with a more useful taxonomy:

| ID | Name | Color | Purpose |
|----|------|-------|---------|
| `phys` | Physical Mechanisms | `#0066CC` | QM, non-locality, holographic, EM theories |
| `bio` | Biological / Physiological | `#00AA44` | Neural, microtubule, physiological correlates |
| `psych` | Psychological / Cognitive | `#CC3300` | Biases, personality, altered states |
| `method` | Methodology & Statistics | `#FF9900` | Experimental design, replication, meta-analysis |
| `theory` | Theoretical Frameworks | `#9933CC` | Overarching integrative theories |
| `phenom` | Phenomenology | `#0099CC` | Types of psi: ESP, PK, precognition |
| `skeptic` | Skeptical / Alternative | `#666666` | Artifact explanations, null hypothesis |
| `consc` | Consciousness Studies | `#CC6699` | NDE, OBE, hard problem |
| `cultural` | Cultural / Social | `#00CCCC` | Belief systems, cultural variables |
| `found` | Foundational Science | `#336699` | Info theory, QM, relativity (non-psi background) |

Remove unused default categories via direct JSON edit or leave them (harmless).

---

## Step 4: Build Node Hierarchy (~90 nodes)

### Top level
```
P1: Psi Phenomena (root, trust=1.0)
├── P2: Psi Phenomena Exist (explores pro-psi hypotheses)
└── P3: Psi Phenomena Do Not Exist (explores skeptical alternatives)
```

### Under "Psi Phenomena Exist" (P2)

**Phenomenological Evidence** (category: `phenom`)
- ESP / Extrasensory Perception
  - Ganzfeld Evidence (ES~0.07-0.08, registered report meta-analysis)
  - Remote Viewing (SRI/SAIC programs)
  - Telepathic Dream Studies
- Precognition / Presentiment
  - Bem (2011) Precognition Studies (d=0.22 → replications d=0.04)
  - Presentiment / Anticipatory Physiology (meta-analysis exists, critiques strong)
  - Retro-PK / Retroactive Influence
- Psychokinesis (PK)
  - Micro-PK / RNG Studies (Bosch 2006: tiny effect, publication bias pattern)
  - DMILS (Direct Mental Interaction with Living Systems)

**Physical Mechanisms** (category: `phys`)
- Non-Local Correlation Model (psi as weak statistical bias, not energy transmission)
  - Quantum Non-Locality (Bell tests confirm, but no-signaling holds)
  - No-Signaling Constraint (Eberhard & Ross 1989)
- Holographic / Information-Theoretic
  - Bohm's Implicate Order
  - Holographic Principle (Bekenstein-Bousso bounds)
  - Pribram's Holonomic Brain Theory
- TSVF — Two-State Vector Formalism (Aharonov)
  - Time-Symmetric QM for Precognition
  - Four Constraints on Any Retrocausal Mechanism
- Radiational / Signal Theories (LOW trust)
  - EM Carrier (attenuation, shielding problems)
  - ELF / Geomagnetic Correlations
  - Gravity Carrier — **FALSIFIED** by GW170817
  - Tachyon / Psitron — unsupported
- Observational Theory (Schmidt/Walker)

**Biological / Physiological** (category: `bio`)
- Microtubules / Quantum Biology
  - Orch-OR (Penrose-Hameroff)
  - Microtubule Excitation Migration (Kalra et al. 2022/2023)
  - Anesthetic Effects on Microtubules (Khan et al. 2024)
- Neural Correlates of Psi
  - Unconscious Processing
  - Sensory Noise Reduction (Ganzfeld rationale)
- Evolutionary Psi / Animal Psi

**Psychological / Cognitive Factors** (category: `psych`)
- Psi-Conducive Variables (belief, openness, extraversion, emotional bonding)
- PMIR (Psi-Mediated Instrumental Response)
- Altered States and Psi

**Theoretical Frameworks** (category: `theory`)
- Holorressonance Model (Stern)
- Consciousness-Based Frameworks

### Under "Psi Phenomena Do Not Exist" (P3)

**Methodological Artifacts** (category: `method`)
- Publication Bias / Funnel Plot Asymmetry
- Selective Reporting / p-hacking
- Experimenter Effect / Demand Characteristics
- Sensory Leakage
- Randomization Failures

**Cognitive Explanations** (category: `skeptic`)
- Inaccurate Recall / Memory Distortion
- Confirmation Bias / Illusory Correlation
- Illusion of Control
- Reasoning Errors

**Replication Failure Evidence** (category: `method`)
- Bem Replication Failures (Galak et al. 2012)
- File Drawer Problem / Optional Stopping

**Neuroscience of Anomalous Experience** (category: `consc`)
- Temporal Lobe / Psychosis Hypothesis
- Subconscious Perception
- AWARE-II NDE Results (no visual target confirmed)

---

## Step 5: Add References (~40+) with Brief Descriptions

Each reference gets a `--description` summarizing its contribution. Grouped by domain:

**Foundational Physics**
- Shannon (1948) — Information theory foundations; defines entropy, channel capacity
- Aharonov, Bergmann & Lebowitz (1964) — TSVF: time-symmetric QM measurement theory
- Wootters & Zurek (1982) — No-cloning theorem constraining quantum info copying
- Eberhard & Ross (1989) — Proof that QFT cannot provide FTL communication
- Hensen et al. (2015) — Loophole-free Bell test confirming quantum non-locality
- Penrose (2014) — Gravitization of QM; Orch-OR framework
- Bohm (1980) — Implicate/explicate order; holographic interpretation
- Bousso (2002) — Holographic principle review
- GW170817 / Abbott et al. (2017) — Constrains gravity speed to c

**Ganzfeld / ESP**
- Honorton et al. (1990) — Autoganzfeld studies establishing modern paradigm
- Storm, Tressoldi & Di Risio (2010) — Psych Bulletin Ganzfeld meta-analysis (positive)
- Hyman (2010) — Critique of Storm 2010 meta-analysis
- Tressoldi et al. (2024) — Stage 2 registered report: ES~0.074-0.084

**Precognition / Presentiment**
- Bem (2011) — Nine precognition experiments (d~0.22); sparked replication crisis debate
- Galak et al. (2012) — Large-scale Bem replications (d=0.04, null)
- Mossbridge, Tressoldi & Utts (2012) — Presentiment meta-analysis
- Wagenmakers et al. (2011) — Bayesian critique of Bem's methods

**PK / RNG**
- Schmidt (1974, 1975) — Classic micro-PK and observational theory papers
- Bosch, Steinkamp & Boller (2006) — RNG-PK meta-analysis: tiny effect, pub bias

**Consciousness / NDE / OBE**
- Parnia et al. (2014) — AWARE multi-center NDE study
- Parnia et al. (2023) — AWARE-II: no visual target confirmed
- Penrose & Hameroff (2014) — Updated Orch-OR review

**Microtubule / Quantum Biology**
- Kalra et al. (2022/2023) — Electronic excitation migration in microtubules
- Khan et al. (2024) — Epothilone B delays anesthetic-induced unconsciousness
- Donadi et al. (2021) — Underground test of gravity-related collapse (constrains Orch-OR)

**Psychological / Methodology**
- Irwin (1985) — Psi phenomena and absorption domain
- Braud (1975) — Conscious vs unconscious clairvoyance
- Stokes (1987) — Critical survey of psi theories (Ch. 5)
- Radin (1997) — The Conscious Universe: overview of psi evidence
- Cardeña (2018) — American Psychologist review of psi experimental evidence

**Skeptical / Critical**
- Blackmore (1986) — Skeptical perspective on psi research
- Alcock (2003) — Give the null hypothesis a chance
- Wiseman & Milton (1999) — Critique of SAIC remote viewing

**Cultural / Social**
- Lesser & Paisner (1985) — Magical thinking in formal operational adults
- Schumaker (1990) — Paranormal belief as cognitive defense

---

## Step 6: Trust Assignment Methodology

Trust values follow the existing scale from `types.ts`:

| Value | Label | Criteria for Assignment |
|-------|-------|------------------------|
| 0.0 | Falsified | Contradicted by established physics or definitive experiment |
| 0.2 | Very Low | Speculative, no evidence, or contradicted |
| 0.4 | Low | Theoretical basis but weak/contested evidence |
| 0.6 | Medium | Mixed evidence, or promising but not well-replicated |
| 0.8 | High | Multiple supporting studies, meta-analytic support |
| 1.0 | Logic Deduction | Follows from established science |

**Key assignments:**
- Ganzfeld Evidence: edge trust 0.6 (meta-analytic support but contested)
- Bem Precognition: 0.2 (replications failed)
- Non-Local Correlation Model: 0.8 (consistent with established physics)
- Quantum Non-Locality: 1.0 (established, Bell tests)
- TSVF for Precognition: 0.4 (sound physics, speculative psi application)
- Gravity Carrier: 0.0 (falsified by GW170817)
- Orch-OR: 0.4 (controversial, some experimental support)
- Publication Bias: 0.8 (well-documented)
- Cognitive Bias explanations: 0.8 (established psychology)

---

## Step 7: Cross-Links (DAG, not just tree)

Key non-tree edges connecting related concepts:
- TSVF → Precognition/Presentiment (derivation)
- Publication Bias → Ganzfeld Evidence (implication, weakening)
- Microtubules → Non-Local Correlation (derivation, possible interface)
- Observational Theory → Retro-PK (implication)
- Sensory Noise Reduction → Ganzfeld (derivation)
- Belief in Psi → Sheep-Goat Effect in Ganzfeld (implication)

---

## Step 8: CLI Execution Sequence

1. **Code changes** (Step 1) — modify types, CLI, UI, tests
2. **Run tests**: `npm test`
3. **Init graph**: `npm run mpsi -- init --file psi-literature.json`
4. **Add categories**: 10 `category add` commands
5. **Build node tree**: ~90 `node add` commands with `--description` and `--keywords`
6. **Set edge trust**: `edge update` for each edge
7. **Add references**: ~40 `ref add` commands with `--description`
8. **Link references to nodes**: ~80 `ref link` commands
9. **Add cross-links**: ~10 `edge add` commands
10. **Propagate trust**: `trust propagate`
11. **Review**: `trust show --format table`, `export dot`

---

## Step 9: External Identifiers on References

Before any agent can search and deduplicate, references need external IDs.

**9a. Extend Reference type**
- File: `src/domain/types.ts`

```typescript
doi: string;               // e.g. "10.1037/a0021524"
url: string;               // direct link
semanticScholarId: string; // S2 corpus ID
openAlexId: string;        // OpenAlex work ID
abstract: string;          // full abstract text
```

**9b. Backfill in JSON loader**
- File: `src/io/json-io.ts` — default all new string fields to `''`

**9c. Extend `ref add` and `ref update` CLI**
- File: `src/cli/commands/ref.ts` — add `--doi`, `--url`, `--abstract` options

**9d. Add `ref show <id>` subcommand**
- Full reference details + linked nodes (follows `node show` pattern)

**9e. Add `ref search` subcommand**
- Search refs by title/author/DOI/description

---

## Step 10: Provenance, Review Status, and Governance

### 10a. New types
- File: `src/domain/types.ts`

```typescript
export type ProvenanceSource = 'human' | 'agent';

export interface Provenance {
  source: ProvenanceSource;
  agent?: string;        // e.g. "literature-scanner"
  timestamp: string;     // ISO 8601
  runId?: string;        // groups items from one agent run
  searchQuery?: string;  // what query found this
  apiSource?: string;    // "semantic-scholar" | "openalex" | etc.
  aiClassification?: 'in-scope-core' | 'in-scope-adjacent' | 'out-of-scope';
  mappingConfidence?: number;  // 0-1: how confident the agent is this maps correctly
}

export type ReviewStatus = 'draft' | 'pending-review' | 'approved' | 'rejected';
export type NodeStatus = 'active' | 'stale' | 'merged';
```

### 10b. Optional fields on existing interfaces
- File: `src/domain/types.ts`

Add to `GraphNode`, `GraphEdge`, and `Reference` (all optional — no migration):
```typescript
provenance?: Provenance;
reviewStatus?: ReviewStatus;
lastReviewedAt?: string;  // ISO 8601
status?: NodeStatus;      // active/stale/merged (nodes only)
```

Add to `GraphData`:
```typescript
metadata?: {
  lastAgentRun?: string;
  lastAgentRunId?: string;
  totalAgentRuns?: number;
};
```

### 10c. Review CLI commands
- New file: `src/cli/commands/review.ts`
- Register in: `src/cli/index.ts`

```
mpsi review list [--status draft|pending-review|approved|rejected]
mpsi review approve <id>
mpsi review reject <id>
mpsi review pending   # shorthand for list --status pending-review
```

### 10d. Hard governance checks (enforced in batch import and ref/node add)
- Reject new node with empty description (when `--require-description` is set)
- Reject reference without title + year + at least one of DOI/URL
- Enforce duplicate rejection (DOI exact, S2 ID exact, fuzzy title+year fallback)
- Configurable daily caps: max new nodes (default 20), max new refs (default 50)
- Cap daily trust delta per node (prevent large swings from a single run)

### 10e. Filter existing commands by review status
- Files: `src/cli/commands/node.ts`, `src/cli/commands/ref.ts`
- Add `--review-status <status>` filter to `node list` and `ref list`

---

## Step 11: Batch Operations and Audit Trail

### 11a. Batch import command
- New file: `src/cli/commands/batch.ts`
- Register in: `src/cli/index.ts`

```
mpsi batch import --input <file.json> [--review-status draft]
```

Input format:
```json
{
  "nodes": [
    { "parentId": "P3", "name": "...", "description": "...", "categoryId": "phenom", "keywords": ["..."] }
  ],
  "references": [
    { "title": "...", "authors": ["..."], "year": 2024, "doi": "10.xxx/yyy", "description": "...", "linkToNodes": ["P5"] }
  ],
  "edges": [
    { "sourceId": "P5", "targetId": "P13", "trust": 0.6, "type": "derivation" }
  ]
}
```

Behavior:
- Validates all parent/target IDs exist
- Runs governance checks (dedup, description required, daily caps)
- Auto-assigns IDs
- Sets provenance on all created items
- Writes audit log entry for each action
- Runs trust propagation once at the end
- Outputs summary of created/skipped/rejected items

### 11b. Audit trail
- New file: `src/agent/audit.ts`
- Append-only JSONL log per day at `research/runs/YYYY-MM-DD/audit.jsonl`

Each entry:
```json
{
  "timestamp": "...",
  "runId": "...",
  "action": "add-reference",
  "entityType": "reference",
  "entityId": "ref-xxx",
  "sourceApis": ["semantic-scholar"],
  "aiClassification": "in-scope-core",
  "mappingConfidence": 0.85,
  "validationOutcome": "accepted",
  "before": null,
  "after": { "title": "...", "doi": "..." }
}
```

### 11c. Snapshots and rollback
- Save immutable graph snapshot after each agent run: `research/snapshots/psi-map-YYYY-MM-DD.json`
- Rollback command: `mpsi snapshot rollback --date YYYY-MM-DD`

### 11d. Diff command
- New file: `src/cli/commands/changelog.ts`

```
mpsi diff <file1> <file2>
    # structural diff: added/removed nodes, changed trust, added refs
```

---

## Step 12: Literature Search Integration

### 12a. Search types
- New file: `src/agent/search/types.ts`

```typescript
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
```

### 12b. API clients (all use native `fetch()`, no new dependencies)
- `src/agent/search/semantic-scholar.ts` — primary, free, keyword + citation graph
- `src/agent/search/openalex.ts` — secondary, completely free, broad coverage
- `src/agent/search/crossref.ts` — DOI resolution and metadata enrichment
- `src/agent/search/index.ts` — unified facade

### 12c. Deduplication
- New file: `src/agent/search/dedup.ts`
- Match by: exact DOI, exact S2 ID, or fuzzy title+year+author

### 12d. Resilience
- Exponential backoff retries (max 3) for API failures
- Partial-source tolerance (continue if one API is down)
- Rate-aware scheduling (respect S2's 100 req/5min, etc.)

### 12e. Literature CLI commands
- New file: `src/cli/commands/literature.ts`

```
mpsi literature search --query <q> [--api semantic-scholar|openalex] [--limit 20] [--year-min 2000]
mpsi literature resolve --doi <doi>
mpsi literature citations --doi <doi> [--direction citing|cited-by]
mpsi literature enrich --ref-id <id>   # fill in DOI/abstract from external APIs
```

Read-only — output JSON, don't modify graph.

---

## Step 13: Agent Loop and State

### 13a. Agent state persistence
- New file: `src/agent/state.ts`

Stored as `.mpsi-agent-state.json`:
```typescript
export interface AgentState {
  lastRunTimestamp: string;
  lastRunId: string;
  totalRuns: number;
  recentSearchQueries: string[];
  searchCursors: Record<string, string>;
}
```

### 13b. Agent configuration
- New file: `src/agent/config.ts`

Stored as `.mpsi-agent-config.json`:
```typescript
export interface AgentConfig {
  searchApis: string[];
  maxResultsPerQuery: number;       // default: 20
  maxQueriesPerRun: number;         // default: 30
  maxNewNodesPerRun: number;        // default: 5
  maxNewRefsPerRun: number;         // default: 20
  citationSnowballsPerRun: number;  // default: 25
  defaultReviewStatus: ReviewStatus;
  yearRange: [number, number];
  focusKeywords: string[];
  excludeKeywords: string[];
  rateLimitMs: number;
}
```

### 13c. Agent CLI commands
- New file: `src/cli/commands/agent.ts`

```
mpsi agent status    # last run, pending items, coverage gaps summary
mpsi agent gaps      # nodes with no refs, stale refs, low-trust needing evidence
mpsi agent state     # show raw agent state
mpsi agent reset     # clear agent state
```

### 13d. Discovery flow (what Claude does each run)

```
1. SEED:      Generate search intents from node names, descriptions, keywords, linked refs
2. HARVEST:   Query APIs with rate-aware scheduling
3. NORMALIZE: Canonicalize title/DOI/authors/year/source IDs
4. DEDUP:     DOI exact → S2 ID exact → fuzzy title+year+author
5. CLASSIFY:  in-scope-core / in-scope-adjacent / out-of-scope
6. MAP:       Map to existing nodes with confidence; create new node only when novelty threshold exceeded
7. APPLY:     Batch import with review-status=draft
8. RECOMPUTE: trust propagate
9. AUDIT:     Write audit log + daily snapshot
10. SYNC:     vault sync --direction graph-to-vault
```

### 13e. Cron entry (Claude Code)

```bash
# daily scan
0 8 * * * cd /path/to/psi-literature && claude -p "Run a literature scan cycle: \
  1. Run 'npm run mpsi -- agent gaps' to find what needs evidence \
  2. Run 'npm run mpsi -- literature search' for the top gaps \
  3. Evaluate results for relevance and build a batch import JSON \
  4. Run 'npm run mpsi -- batch import' with review-status=draft \
  5. Run 'npm run mpsi -- vault sync --direction graph-to-vault' \
  6. Git commit the changes" --allowedTools Bash,Read,Write
```

### 13f. Guardrails
- Agent only searches keywords already in the graph (no scope drift)
- All agent content starts as `draft` — never auto-approved
- Agent does NOT assign trust values to edges (human judgment)
- Full provenance on every item (runId, query, API source, classification, confidence)
- Configurable caps per run (nodes, refs, queries)

---

## Step 14: Obsidian Vault Sync

### 14a. Vault structure
```
psi-literature-vault/
  nodes/
    {category}/
      {node-id}-{slug}.md
  references/
    {year}/
      {ref-id}-{slug}.md
  agent-runs/
    {date}-{run-id}.md
```

### 14b. Node note template

```markdown
---
id: P47
name: Ganzfeld Evidence
category: phenom
trust: 0.6
reviewStatus: approved
keywords: [ganzfeld, meta-analysis, ESP]
referenceIds: [ref-001, ref-002]
---

# Ganzfeld Evidence

[Auto-generated summary from node description]

## References
- [[ref-001-tressoldi-2024]]
- [[ref-002-storm-2010]]

## Related Nodes
- Parent: [[P10-esp]]
- See also: [[P26-sensorial-noise]], [[P50-publication-bias]]

## Notes
_Human annotations — preserved across syncs, never overwritten._
```

### 14c. Reference note template

```markdown
---
id: ref-001
title: "Ganzfeld Registered Report"
authors: [Tressoldi, Storm, Radin]
year: 2024
doi: "10.xxx/yyy"
reviewStatus: approved
---

# Tressoldi et al. (2024)

[Abstract / description]

## Linked Nodes
- [[P47-ganzfeld-evidence]]

## Reading Notes
_Human annotations — preserved across syncs._
```

### 14d. Vault sync module
- `src/vault/sync.ts` — core sync logic
- `src/vault/templates.ts` — markdown generation
- `src/vault/frontmatter.ts` — YAML frontmatter parse/serialize

### 14e. Vault CLI commands
- New file: `src/cli/commands/vault.ts`

```
mpsi vault init --path <dir>
mpsi vault sync --path <dir> [--direction graph-to-vault|vault-to-graph|both]
mpsi vault status --path <dir>
```

### 14f. Sync rules
- Graph-to-vault: updates frontmatter, NEVER overwrites `## Notes` section
- Vault-to-graph: reads back `reviewStatus`, `trust`, `description` from frontmatter
- Version-controlled in the same git repo

---

## Step 15: Visualization for Graph Growth

As the graph scales beyond ~100 nodes, the UI needs better navigation.

### 15a. Layered clusters
- Cluster by family: core psi signal, methodological artifacts, physics constraints, cognitive explanations, replication outcomes
- Collapse/expand clusters in the React Flow UI

### 15b. Filters
- Filter by: review status, category, date range, source API, trust range
- Edge threshold slider (hide low-trust edges)
- "Recent changes" overlay (nodes/edges changed in last N days)

### 15c. Focus mode
- k-hop ego graph: select a node, show only its N-hop neighborhood
- Useful for deep-diving into a specific hypothesis

### 15d. Layout stability
- Preserve manual positions when user pins nodes
- Re-layout only affected cluster/subgraph when possible
- Dynamic node sizing (bigger = higher trust or more references)

---

## Operational Outputs

Daily artifacts generated by agent runs:
```
research/runs/YYYY-MM-DD/
  discovery-candidates.json    # raw search results
  discovery-applied.json       # what was actually imported
  audit.jsonl                  # append-only action log
research/snapshots/
  psi-map-YYYY-MM-DD.json     # immutable daily snapshot
```

---

## Implementation Order

```
Step 1  (CLI improvements)        <- foundation
Step 9  (external IDs on refs)    <- needed for agent search
Step 10 (provenance + review + governance)
   |
Step 2-8 (build initial graph)
   |
Step 11 (batch ops + audit trail)
Step 12 (literature search APIs)
   |
Step 13 (agent loop + state)
Step 14 (Obsidian vault sync)     <- parallel with 13
Step 15 (visualization)           <- parallel with 13-14
```

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/cli/commands/review.ts` | Review workflow commands |
| `src/cli/commands/batch.ts` | Batch import with governance |
| `src/cli/commands/changelog.ts` | Diff between graph versions |
| `src/cli/commands/literature.ts` | External literature search |
| `src/cli/commands/agent.ts` | Agent status/gaps/state |
| `src/cli/commands/vault.ts` | Obsidian vault sync |
| `src/agent/search/types.ts` | Search result types |
| `src/agent/search/semantic-scholar.ts` | Semantic Scholar API |
| `src/agent/search/openalex.ts` | OpenAlex API |
| `src/agent/search/crossref.ts` | CrossRef API |
| `src/agent/search/dedup.ts` | Reference deduplication |
| `src/agent/search/index.ts` | Unified search facade |
| `src/agent/state.ts` | Agent state persistence |
| `src/agent/config.ts` | Agent configuration |
| `src/agent/audit.ts` | JSONL audit trail |
| `src/vault/sync.ts` | Graph <-> vault sync |
| `src/vault/templates.ts` | Markdown templates |
| `src/vault/frontmatter.ts` | YAML frontmatter handling |

## Modified Files Summary

| File | Changes |
|------|---------|
| `src/domain/types.ts` | Reference fields, Provenance/ReviewStatus/NodeStatus types, optional fields |
| `src/io/json-io.ts` | Backfill new Reference fields |
| `src/io/legacy-import.ts` | Map rabstract -> description |
| `src/cli/index.ts` | Register 6 new command modules |
| `src/cli/commands/ref.ts` | --description/--doi/--url/--abstract, ref update/show/search |
| `src/cli/commands/node.ts` | --description/--keywords on add, --require-description, --review-status filter |
| `src/components/references/ReferenceDialog.tsx` | Description/DOI fields |
| `src/components/references/ReferenceList.tsx` | Display description + completeness indicator |

## Verification

### Phase A (code changes)
1. `npm test` — all tests pass

### Phase B (initial graph)
2. `node list --format table` — ~90 nodes
3. `ref list --format table` — ~40 refs with descriptions
4. `trust show --format table` — propagation correct
5. `export dot` — graph exports

### Phase C (agent)
6. `literature search --query "ganzfeld psi" --limit 5` — returns Semantic Scholar results
7. `batch import --input test.json --review-status draft` — creates items with provenance + audit log
8. `review pending` — shows draft items
9. `agent gaps` — identifies evidence gaps
10. Verify `research/runs/` has audit.jsonl and snapshot

### Phase D (vault + viz)
11. `vault init && vault sync` — generates notes with frontmatter + wikilinks
12. Cluster collapse/expand works in UI
13. Focus mode isolates local neighborhood
14. End-to-end: full agent cycle produces git diff with drafts, audit, vault notes
