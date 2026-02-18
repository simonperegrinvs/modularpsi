# ModularPsi CLI Reference

Command-line interface for managing ModularPsi knowledge graphs. Designed for scripting and AI agent integration.

## Usage

```
npm run mpsi -- [options] <command> [subcommand] [arguments]
```

## Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --file <path>` | Graph data file path | `./modularpsi.json` (or last-used file from `~/.mpsirc`) |
| `--format <format>` | Output format: `json`, `table`, or `quiet` | `json` |
| `-V, --version` | Show version | |
| `-h, --help` | Show help | |

The CLI remembers the last-used file path in `~/.mpsirc`. You can also set `MPSI_FILE` environment variable.

## Output Formats

- **json** (default): Pretty-printed JSON. Best for programmatic parsing.
- **table**: Human-readable aligned table.
- **quiet**: Minimal output — IDs only, one per line.

## Commands

### init

Create a new empty graph file with a root node (P1).

```
npm run mpsi -- init
npm run mpsi -- -f my-graph.json init
```

**Output (json):**
```json
{ "status": "ok", "file": "./modularpsi.json" }
```

Fails if the file already exists.

---

### node show \<id\>

Show full details for a node, including its outgoing edges.

```
npm run mpsi -- node show P1
```

**Output fields:** `id`, `name`, `description`, `categoryId`, `keywords`, `type`, `trust`, `referenceIds`, `edges[]`

### node list

List all nodes in the graph.

```
npm run mpsi -- node list
npm run mpsi -- node list --review-status draft
```

| Option | Description |
|--------|-------------|
| `--review-status <status>` | Filter by review status (`draft`, `pending-review`, `approved`, `rejected`) |

**Output fields:** `id`, `name`, `trust`, `type`, `category`

### node add

Add a new node connected to a parent.

```
npm run mpsi -- node add --parent P1 --name "Telepathy evidence"
npm run mpsi -- node add --parent P1 --name "Options" --type chooser --category bio
npm run mpsi -- node add --parent P1 --name "Evidence" --description "Study results" --keywords "telepathy;meta-analysis"
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--parent <id>` | Yes | Parent node ID | |
| `--name <name>` | Yes | Node name | |
| `--type <type>` | No | `regular`, `chooser`, or `holder` | `regular` |
| `--category <cat>` | No | Category ID | `general` |
| `--description <desc>` | No | Node description | `""` |
| `--keywords <kw>` | No | Semicolon-separated keywords | `""` |

**Output fields:** `id`, `name`

The new edge gets trust=-1 (unclassified). Trust is re-propagated after adding.

### node update \<id\>

Update one or more fields on an existing node.

```
npm run mpsi -- node update P2 --name "Updated name" --description "New desc"
npm run mpsi -- node update P2 --keywords "telepathy;evidence;meta-analysis"
npm run mpsi -- node update P2 --type chooser
```

| Option | Description |
|--------|-------------|
| `--name <name>` | New name |
| `--description <desc>` | New description |
| `--category <cat>` | New category ID |
| `--keywords <kw>` | Semicolon-separated keywords |
| `--type <type>` | `regular`, `chooser`, or `holder` |

### node delete \<id\>

Delete a leaf node (no outgoing edges). Also removes all incoming edges.

```
npm run mpsi -- node delete P5
```

Fails if the node has outgoing edges.

---

### edge list

List all edges, optionally filtered by node.

```
npm run mpsi -- edge list
npm run mpsi -- edge list --node P1
```

| Option | Description |
|--------|-------------|
| `--node <id>` | Filter edges connected to this node (source or target) |

**Output fields:** `id`, `source`, `target`, `trust`, `type`, `combinedTrust`

### edge add

Add a new edge between two existing nodes.

```
npm run mpsi -- edge add --source P1 --target P3 --trust 0.8
npm run mpsi -- edge add --source P1 --target P3 --type derivation
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--source <id>` | Yes | Source node ID | |
| `--target <id>` | Yes | Target node ID | |
| `--trust <n>` | No | Trust value (-1 to 1) | `-1` |
| `--type <type>` | No | `implication`, `derivation`, `possibility`, `requires`, `confounded-by`, `incompatible-with`, or `fails-when` | `implication` |

Fails if: self-loop, duplicate edge, or source/target node not found.

### edge update \<id\>

Update trust or type on an existing edge.

```
npm run mpsi -- edge update P1-P3 --trust 0.6
npm run mpsi -- edge update P1-P3 --type possibility
```

| Option | Description |
|--------|-------------|
| `--trust <n>` | New trust value |
| `--type <type>` | New edge type (including constraint semantics) |

### edge delete \<id\>

Delete an edge. Fails if the target node would be disconnected (must have 2+ incoming edges).

```
npm run mpsi -- edge delete P1-P3
```

---

### trust show

Show propagated trust values for all nodes or a specific node. Re-propagates in memory without saving to file (use `trust propagate` to save).

```
npm run mpsi -- trust show
npm run mpsi -- trust show --node P3
```

| Option | Description |
|--------|-------------|
| `--node <id>` | Show trust details for a specific node (includes incoming edges) |

For a specific node, output includes `incomingEdges[]` with `from`, `edgeTrust`, and `combinedTrust`.

### trust propagate

Re-propagate trust values from the root and save to file.

```
npm run mpsi -- trust propagate
```

**Output:** `{ "status": "ok", "nodesUpdated": <count> }`

---

### search \<query\>

Search nodes by name, description, or keywords (case-insensitive substring match).

```
npm run mpsi -- search "telepathy"
```

**Output fields:** `id`, `name`, `trust`, `category`

---

### category list

List all categories.

```
npm run mpsi -- category list
```

**Output fields:** `id`, `name`, `color`, `description`

### category add

Add a new category.

```
npm run mpsi -- category add --id neuro --name "Neuroscience" --color "#FF8800"
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--id <id>` | Yes | Category ID | |
| `--name <name>` | Yes | Category name | |
| `--color <hex>` | No | Hex color | `#000000` |
| `--description <desc>` | No | Description | `""` |

### category update \<id\>

Update a category.

```
npm run mpsi -- category update neuro --name "Neuroscience Research" --color "#00FF88"
```

---

### ref list

List all references, optionally filtered by node or review status.

```
npm run mpsi -- ref list
npm run mpsi -- ref list --node P3
npm run mpsi -- ref list --review-status draft
```

| Option | Description |
|--------|-------------|
| `--node <id>` | Filter by linked node |
| `--review-status <status>` | Filter by review status |

### ref show \<id\>

Show full details for a reference, including linked nodes.

```
npm run mpsi -- ref show ref-123
```

### ref add

Add a new reference.

```
npm run mpsi -- ref add --title "Study of Psi" --authors "Smith;Jones" --year 2020
npm run mpsi -- ref add --title "Ganzfeld" --authors "Tressoldi" --year 2024 --description "Registered report" --doi "10.xxx/yyy"
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--title <title>` | Yes | Reference title | |
| `--authors <authors>` | No | Semicolon-separated author names | `""` |
| `--year <year>` | No | Publication year | `0` |
| `--description <desc>` | No | Brief description | `""` |
| `--journal <journal>` | No | Journal/publication name | `""` |
| `--citation <citation>` | No | Full citation string | `""` |
| `--doi <doi>` | No | DOI identifier | `""` |
| `--url <url>` | No | Direct URL | `""` |
| `--abstract <abstract>` | No | Full abstract text | `""` |

### ref update \<id\>

Update one or more fields on an existing reference.

```
npm run mpsi -- ref update ref-123 --doi "10.1037/a0021524" --description "Updated description"
```

Accepts all the same options as `ref add`.

### ref search \<query\>

Search references by title, author, DOI, or description.

```
npm run mpsi -- ref search "ganzfeld"
```

### ref link \<ref-id\> \<node-id\>

Link a reference to a node.

```
npm run mpsi -- ref link ref-123 P3
```

### ref unlink \<ref-id\> \<node-id\>

Unlink a reference from a node.

```
npm run mpsi -- ref unlink ref-123 P3
```

---

### review list

List items (nodes and references) with review status.

```
npm run mpsi -- review list
npm run mpsi -- review list --status draft
```

| Option | Description |
|--------|-------------|
| `--status <status>` | Filter: `draft`, `pending-review`, `approved`, `rejected` |

### review pending

List items pending review (shorthand for `review list` with draft/pending-review).

```
npm run mpsi -- review pending
```

### review approve \<id\>

Approve a node or reference.

```
npm run mpsi -- review approve P5
npm run mpsi -- review approve ref-123
```

For references, this also sets `processingStatus=approved`.

### review reject \<id\>

Reject a node or reference.

```
npm run mpsi -- review reject P5
```

For references, this also sets `processingStatus=rejected`.

---

### hypothesis list

List hypothesis cards, optionally filtered by status.

```
npm run mpsi -- hypothesis list
npm run mpsi -- hypothesis list --status pending-review
```

### hypothesis show \<id\>

Show full details for a hypothesis card.

```
npm run mpsi -- hypothesis show hyp-1
```

### hypothesis add

Add a new hypothesis card.

```
npm run mpsi -- hypothesis add --statement "Ganzfeld signal depends on strict blinding"
npm run mpsi -- hypothesis add --statement "Constraint candidate" --linked-nodes P6,P11 --support-refs ref-1,ref-2 --score 0.62
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--statement <text>` | Yes | Hypothesis statement | |
| `--linked-nodes <ids>` | No | Comma-separated linked node IDs | empty |
| `--support-refs <ids>` | No | Comma-separated supporting ref IDs | empty |
| `--contradict-refs <ids>` | No | Comma-separated contradicting ref IDs | empty |
| `--constraint-edges <ids>` | No | Comma-separated constraint edge IDs | empty |
| `--score <n>` | No | Initial score | `0` |
| `--status <status>` | No | `draft`, `pending-review`, `approved`, `rejected` | `draft` |
| `--run-id <id>` | No | Provenance run ID | |

### hypothesis update \<id\>

Update one or more fields on an existing hypothesis card.

```
npm run mpsi -- hypothesis update hyp-1 --status pending-review --score 0.78
npm run mpsi -- hypothesis update hyp-1 --contradict-refs ref-9
```

### hypothesis triage

Re-score hypothesis cards and select top candidates for review.

```
npm run mpsi -- hypothesis triage
npm run mpsi -- hypothesis triage --top 5 --min-score 0.65
npm run mpsi -- hypothesis triage --top 5 --promote
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--top <n>` | No | Max number of cards selected | `10` |
| `--min-score <n>` | No | Score threshold (0-1) | `0.6` |
| `--promote` | No | Promote selected drafts to `pending-review` | false |

### hypothesis propose

Run a generator/skeptic/judge loop over claim-backed nodes and propose new draft hypothesis cards.

```
npm run mpsi -- hypothesis propose
npm run mpsi -- hypothesis propose --top 3 --run-id run-20260218-a
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--top <n>` | No | Max number of generated proposals | `5` |
| `--run-id <id>` | No | Provenance run ID for created cards | |

---

### batch import

Batch import nodes, references, and edges from a JSON file with publish gate validation, governance, and audit trail.

```
npm run mpsi -- batch import --input data.json
npm run mpsi -- batch import --input data.json --review-status draft --audit-dir ~/data
npm run mpsi -- batch import --input data.json --force   # Skip publish gate validation
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--input <file>` | Yes | JSON file with batch data | |
| `--review-status <status>` | No | Review status for imported items | `draft` |
| `--run-id <id>` | No | Run ID for provenance | auto-generated |
| `--agent <name>` | No | Agent name for provenance | `batch-import` |
| `--snapshot` | No | Save snapshot before importing (now always enabled) | |
| `--audit-dir <dir>` | No | Directory for audit logs | graph file directory |
| `--force` | No | Skip publish gate validation errors | |

Input JSON format:
```json
{
  "nodes": [{ "parentId": "P3", "name": "...", "description": "...", "categoryId": "phenom", "keywords": ["..."] }],
  "references": [{ "title": "...", "authors": ["..."], "year": 2024, "doi": "10.xxx/yyy", "linkToNodes": ["P5"] }],
  "edges": [{ "sourceId": "P5", "targetId": "P13", "trust": 0.6, "type": "derivation" }],
  "provenance": { "searchQuery": "...", "apiSource": "semantic-scholar" }
}
```

Features:
- **Pre-publish gate** — Validates against governance config (daily caps, required fields, duplicates). Aborts on errors unless `--force`.
- **Auto-snapshot** — Always saves a dated snapshot to `research/snapshots/` before importing.
- **Deduplication** — DOI, Semantic Scholar ID, OpenAlex ID, and fuzzy title+year matching.
- **Audit trail** — Extended JSONL audit entries with `aiRationale` and `validationErrors`.
- **Cap warning** — Warns when approaching the daily node cap (5 or fewer remaining).

---

### literature search

Search external literature databases (read-only, does not modify graph).

```
npm run mpsi -- literature search --query "ganzfeld psi" --limit 10
npm run mpsi -- literature search --query "precognition" --api openalex --year-min 2010
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--query <q>` | Yes | Search query | |
| `--api <api>` | No | `semantic-scholar` or `openalex` | `semantic-scholar` |
| `--limit <n>` | No | Max results | `20` |
| `--year-min <year>` | No | Minimum year | |
| `--year-max <year>` | No | Maximum year | |

### literature resolve

Resolve a DOI to paper metadata.

```
npm run mpsi -- literature resolve --doi "10.1037/a0021524"
```

### literature citations

Get citing or cited-by papers for a DOI.

```
npm run mpsi -- literature citations --doi "10.1037/a0021524" --direction citing --limit 10
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--doi <doi>` | Yes | DOI to look up | |
| `--direction <dir>` | No | `citing` or `cited-by` | `citing` |
| `--limit <n>` | No | Max results | `10` |

### literature enrich

Enrich an existing reference with external API data (DOI, abstract, S2 ID).

```
npm run mpsi -- literature enrich --ref-id ref-123
```

---

### agent status

Show agent run history, pending items, and coverage summary.

```
npm run mpsi -- agent status
```

### agent gaps

Identify nodes needing evidence: no references, no description, unclassified trust.

```
npm run mpsi -- agent gaps
```

### agent state

Show raw agent state (last run, search cursors, etc.).

```
npm run mpsi -- agent state
```

### agent reset

Clear agent state to start fresh.

```
npm run mpsi -- agent reset
```

### agent config

View or modify agent configuration.

```
npm run mpsi -- agent config --show
npm run mpsi -- agent config --set maxNewRefsPerRun=30
npm run mpsi -- agent config --set focusKeywords=ganzfeld,precognition,psi
```

### agent discovery status

Show discovery registry summary (candidate/event counts and status breakdown).

```
npm run mpsi -- agent discovery status
npm run mpsi -- agent discovery status --date 2026-02-18
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--date <date>` | No | Filter summary to `YYYY-MM-DD` | all dates |

### agent discovery list

List latest discovery candidates, optionally filtered.

```
npm run mpsi -- agent discovery list
npm run mpsi -- agent discovery list --status deferred --api semantic-scholar
npm run mpsi -- agent discovery list --query "ganzfeld" --date 2026-02-18
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--date <date>` | No | Filter by `YYYY-MM-DD` | all dates |
| `--status <status>` | No | `queued`, `parsed`, `imported-draft`, `duplicate`, `rejected`, or `deferred` | none |
| `--query <query>` | No | Filter by query or title substring | none |
| `--api <api>` | No | `semantic-scholar`, `openalex`, `crossref`, `arxiv` | none |

### agent discovery retry <candidate-id>

Re-queue a discovery candidate for processing.

```
npm run mpsi -- agent discovery retry cand-123
npm run mpsi -- agent discovery retry cand-123 --run-id manual-retry-20260218
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--run-id <id>` | No | Run ID to record for retry event | auto-generated |

### agent discovery ingest

Run discovery ingestion across one or more APIs, append candidates to the discovery registry, update agent state, and optionally add citation-snowball candidates from DOI anchors.

```
npm run mpsi -- agent discovery ingest
npm run mpsi -- agent discovery ingest --query "ganzfeld psi" --api semantic-scholar --limit 10
npm run mpsi -- agent discovery ingest --query "remote viewing" "presentiment" --max-queries 5 --year-min 2000
```

When `--query` is omitted, queries are auto-generated from graph gaps (high-trust/no-reference or unclassified nodes) plus `focusKeywords`.
If DOI references exist, citation snowballing also runs (bounded by `citationSnowballsPerRun` in agent config).

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--query <queries...>` | No | Explicit discovery queries | auto-generated |
| `--api <apis...>` | No | API set (`semantic-scholar`, `openalex`) | from agent config |
| `--limit <n>` | No | Max results per query/API | from agent config |
| `--max-queries <n>` | No | Max number of queries this run | from agent config |
| `--year-min <year>` | No | Minimum publication year | none |
| `--year-max <year>` | No | Maximum publication year | none |
| `--run-id <id>` | No | Run ID for provenance | auto-generated |

### agent discovery reconcile-state

Rebuild in-file agent discovery tracking (`processedCandidateIds`, `discoveryStats`) from the append-only discovery registry.

```
npm run mpsi -- agent discovery reconcile-state
```

### agent claims extract

Extract claim-level entries from reference abstracts and store them on references.

```
npm run mpsi -- agent claims extract
npm run mpsi -- agent claims extract --ref-id ref-123
npm run mpsi -- agent claims extract --ref-id ref-123 --force
```

When no `--ref-id` is provided, extraction runs for all references.

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--ref-id <id>` | No | Extract for a specific reference | all references |
| `--force` | No | Re-extract even if abstract checksum is unchanged | false |

### agent run-note generate

Generate a structured run note markdown file in `<vault>/agent-runs`.

```
npm run mpsi -- agent run-note generate --path ~/data/modularpsi/vault
npm run mpsi -- agent run-note generate --path ~/data/modularpsi/vault --run-id run-42 --date 2026-02-18
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--path <vault>` | Yes | Vault path | |
| `--run-id <id>` | No | Run ID used in note title/filename | last run ID or auto |
| `--date <date>` | No | Note date (`YYYY-MM-DD`) | today |

### agent contradictions

Surface mixed support/contradiction evidence from extracted claims and hypothesis links.

```
npm run mpsi -- agent contradictions
npm run mpsi -- agent contradictions --node P6
npm run mpsi -- agent contradictions --hypothesis hyp-2
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--node <id>` | No | Filter node contradiction summary by node ID | mixed nodes only |
| `--hypothesis <id>` | No | Filter hypothesis contradiction summary by ID | mixed hypotheses only |

### agent metrics

Generate calibration metrics report for the operational loop.

```
npm run mpsi -- agent metrics
npm run mpsi -- agent metrics --period daily
npm run mpsi -- agent metrics --period monthly --now 2026-02-18T00:00:00.000Z
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--period <period>` | No | `daily`, `weekly`, `monthly` | `weekly` |
| `--now <iso>` | No | Override timestamp for reproducible reporting | system time |

UI note: in the web app side panel, when no node/edge is selected, a **Review Queue** view now shows pending hypotheses and contradiction summaries for quick triage.

---

### vault init

Initialize an Obsidian vault directory structure.

```
npm run mpsi -- vault init --path ~/data/modularpsi/vault
```

### vault sync

Sync between graph and Obsidian vault. Preserves human-written `## Notes` sections.

```
npm run mpsi -- vault sync --path ~/data/modularpsi/vault
npm run mpsi -- vault sync --path ~/data/modularpsi/vault --direction vault-to-graph
npm run mpsi -- vault sync --path ~/data/modularpsi/vault --direction both
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--path <dir>` | Yes | Vault directory | |
| `--direction <dir>` | No | `graph-to-vault`, `vault-to-graph`, or `both` | `graph-to-vault` |

Vault structure:
```
vault/
  nodes/{category}/{node-id}-{slug}.md
  references/{year}/{ref-id}-{author}-{year}.md
  agent-runs/
```

### vault status

Show vault file counts and categories.

```
npm run mpsi -- vault status --path ~/data/modularpsi/vault
```

---

### governance config

View or update governance configuration (stored in `.mpsi-governance.json` alongside the graph file).

```
npm run mpsi -- governance config --show
npm run mpsi -- governance config --set maxDailyNewNodes=30
npm run mpsi -- governance config --set requireDescription=false maxDailyTrustDelta=3.0
```

| Option | Description |
|--------|-------------|
| `--show` | Display current config (default behavior) |
| `--set <pairs...>` | Set one or more `key=value` pairs |

**Config keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `maxDailyNewNodes` | number | `20` | Max nodes that can be created per day |
| `maxDailyNewHypotheses` | number | `15` | Max hypotheses that can be created per day |
| `maxDailyConstraintEdges` | number | `40` | Max constraint edges (`requires/confounded-by/incompatible-with/fails-when`) per day |
| `maxDailyTrustDelta` | number | `2.0` | Max sum of absolute trust changes per node per day |
| `requireDescription` | boolean | `true` | Reject nodes without descriptions |
| `requireRefTitleYearDoi` | boolean | `true` | Reject references missing title, year, or DOI/URL |
| `requireHypothesisEvidence` | boolean | `true` | Reject hypotheses without supporting references |
| `duplicateRejection` | boolean | `true` | Reject duplicate nodes/references |
| `fuzzyDuplicateThreshold` | number | `0.85` | Fuzzy title match threshold |

### governance validate

Run publish gate validation on the current graph. Reports all errors and warnings.

```
npm run mpsi -- governance validate
```

Exits with code 1 if validation fails. Useful in CI pipelines.

### governance audit

View audit log entries.

```
npm run mpsi -- governance audit                 # List available audit dates
npm run mpsi -- governance audit --today         # Show today's entries
npm run mpsi -- governance audit --date 2026-02-15
npm run mpsi -- governance audit --entity P5     # Filter by entity ID
```

| Option | Description |
|--------|-------------|
| `--date <YYYY-MM-DD>` | Show entries for a specific date |
| `--today` | Show today's entries |
| `--entity <id>` | Filter entries by entity ID |

### governance stats

Show today's governance statistics: node count, daily cap, remaining capacity.

```
npm run mpsi -- governance stats
```

**Output:** `date`, `todayNodeCount`, `dailyCap`, `remaining`, `totalNodes`, `totalEdges`, `totalReferences`, `maxDailyTrustDelta`

---

### snapshot save

Save a dated snapshot of the current graph to `research/snapshots/`.

```
npm run mpsi -- snapshot save
npm run mpsi -- snapshot save --trigger daily-auto
```

| Option | Description | Default |
|--------|-------------|---------|
| `--trigger <type>` | Trigger type: `manual` or `daily-auto` | `manual` |

### snapshot list

List all available snapshots with metadata.

```
npm run mpsi -- snapshot list
```

**Output:** Array of `{ date, timestamp, trigger, nodeCount, edgeCount, refCount }`

### snapshot show \<date\>

Show summary of a snapshot.

```
npm run mpsi -- snapshot show 2026-02-15
```

### snapshot diff \<date\>

Compare a snapshot against the current graph, showing node/edge/reference count deltas.

```
npm run mpsi -- snapshot diff 2026-02-15
```

**Output:** `{ nodes: { snapshot, current, delta }, edges: {...}, references: {...} }`

### snapshot rollback \<date\>

Rollback the graph to a previous snapshot. Saves a pre-rollback backup automatically.

```
npm run mpsi -- snapshot rollback 2026-02-15 --force
```

| Option | Description |
|--------|-------------|
| `--force` | **Required.** Confirms the destructive rollback operation. |

---

### import \<dir\>

Import a legacy ModularPsi data directory containing `.mpsi`, `.graphml`, and optionally `.xsql` files.

```
npm run mpsi -- import ./legacy-data
npm run mpsi -- -f imported.json import ./legacy-data
```

**Output:** `{ "status": "ok", "nodesImported": N, "edgesImported": N, "categoriesImported": N, "referencesImported": N, "outputFile": "..." }`

### export dot

Export the graph in Graphviz DOT format (printed to stdout).

```
npm run mpsi -- export dot > graph.dot
```

### export png

Render the graph as PNG. Requires Graphviz `dot` command installed.

```
npm run mpsi -- export png --output graph.png
```

---

## Data Model

### Node Types

| Value | Label | Description |
|-------|-------|-------------|
| 0 | `regular` | Standard proposition node |
| 1 | `chooser` | Outgoing edge trusts must sum to 1.0 |
| 2 | `holder` | Container/grouping node |

### Edge Types

| Value | Label | Description |
|-------|-------|-------------|
| 0 | `implication` | Default: source implies target |
| 1 | `derivation` | Target derived from source |
| 2 | `possibility` | Possible relationship |

### Trust Values

| Range | Meaning |
|-------|---------|
| `-1` | Not classified (unclassified) |
| `0.0` | Falsified |
| `0.0–1.0` | Increasing confidence |
| `1.0` | Logic deduction (certain) |

Trust propagates from root (trust=1.0) through edges: `combinedTrust = parentTrust * edgeTrust`. Each node gets the maximum combined trust from all incoming paths.

### Default Categories

| ID | Name |
|----|------|
| `general` | General Aspects of Psi |
| `bio` | Fisiological Aspects of Psi |
| `physical` | Physical Aspects of Psi |
| `psichological` | Psychological Aspects of Psi |
| `cultural` | Cultural Aspects of Psi |
| `na` | N/C |

### Review Status

Items (nodes and references) can have a review status for agent governance:

| Status | Meaning |
|--------|---------|
| `draft` | Agent-added, not yet reviewed |
| `pending-review` | Flagged for human review |
| `approved` | Human-approved |
| `rejected` | Human-rejected |

### Provenance

Agent-added items include provenance metadata:

```json
{
  "source": "agent",
  "agent": "literature-scanner",
  "timestamp": "2026-02-18T10:30:00Z",
  "runId": "run-20260218",
  "searchQuery": "ganzfeld psi",
  "apiSource": "semantic-scholar"
}
```

### Reference Fields

References now include external identifiers for deduplication and enrichment:

| Field | Description |
|-------|-------------|
| `description` | Brief summary of the study |
| `doi` | DOI identifier |
| `url` | Direct URL |
| `semanticScholarId` | Semantic Scholar corpus ID |
| `openAlexId` | OpenAlex work ID |
| `abstract` | Full abstract text |

## File Format

Graph data is stored as JSON (`.json`). See `modularpsi.json` for the default graph.

```json
{
  "version": 1,
  "prefix": "P",
  "rootId": "P1",
  "lastNodeNumber": 5,
  "nodes": [...],
  "edges": [...],
  "categories": [...],
  "references": [...]
}
```

## Typical AI Agent Workflow

```bash
# 1. Initialize or use existing graph
npm run mpsi -- init

# 2. Build graph structure
npm run mpsi -- node add --parent P1 --name "Hypothesis A"
npm run mpsi -- node add --parent P2 --name "Evidence 1"
npm run mpsi -- edge update P2-P3 --trust 0.8

# 3. Query the graph
npm run mpsi -- node list --format json
npm run mpsi -- search "hypothesis"
npm run mpsi -- trust show --node P3

# 4. Iterate: add more evidence, update trust, re-query
npm run mpsi -- node add --parent P2 --name "Evidence 2"
npm run mpsi -- edge update P2-P4 --trust 0.6
npm run mpsi -- trust show
```
