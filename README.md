# ModularPsi

Knowledge graph editor for tracking and evaluating scientific evidence. Build directed acyclic graphs where trust values propagate from root propositions through evidence chains.

## Features

- **Web UI** — Interactive graph editor built with React Flow, with drag-and-drop layout, node/edge editing, and real-time trust visualization
- **Clustered graph layout** — Category-based cluster boundaries, collapsible clusters, degree-scaled node sizing, overlap resolution
- **Interactive filtering** — Filter by category, edge trust threshold, source API, date range, node type, review status, and recent changes; focus mode (k-hop ego graph)
- **CLI** — Full command-line interface for scripting and AI agent integration (`npm run mpsi -- <command>`)
- **Trust propagation** — DFS-based trust calculation from root through edge weights, handles DAGs with cross-links
- **Literature search** — Search Semantic Scholar, OpenAlex, and CrossRef APIs directly from the CLI
- **Batch import** — Governance-controlled import with pre-publish validation gate, deduplication, provenance tracking, and JSONL audit trail
- **Governance guardrails** — Daily node caps, required-field validation, duplicate rejection, configurable via `.mpsi-governance.json`
- **Snapshots & rollback** — Immutable dated snapshots with diff and rollback; auto-snapshot before every batch import
- **Review workflow** — Agent-added content starts as `draft`, with approve/reject workflow for human oversight
- **Obsidian vault sync** — Bidirectional sync to markdown notes with YAML frontmatter and `[[wikilinks]]`
- **Agent loop** — Automated literature scanning via `run-agent.sh` (Claude Code CLI cron job)
- **Legacy import** — Import data from the original ModularPsi XML format (.mpsi, .graphml)
- **Export** — Graphviz DOT and PNG export

## Quick Start

```bash
npm install
npm run dev          # Start web UI at http://localhost:5173
```

### CLI

```bash
npm run mpsi -- init                          # Create new graph
npm run mpsi -- node add --parent P1 --name "Hypothesis A" --description "..."
npm run mpsi -- edge update P1-P2 --trust 0.8
npm run mpsi -- trust show                    # Show propagated trust values
npm run mpsi -- literature search --query "ganzfeld psi" --limit 10
npm run mpsi -- review pending                # See agent-added draft items
```

See [CLI.md](CLI.md) for complete CLI documentation.

### Agent Loop

Run a daily literature scan that finds gaps, searches APIs, and imports new references:

```bash
./run-agent.sh                # Manual one-off run
# Or add to crontab:
# 0 8 * * * /path/to/run-agent.sh
```

All agent content is imported with `reviewStatus: draft`. Review with:
```bash
npm run mpsi -- review pending
npm run mpsi -- review approve <id>
```

## CLI Command Reference

| Command | Description |
|---------|-------------|
| `init` | Create a new empty graph file |
| **Nodes** | |
| `node list` | List all nodes (supports `--review-status` filter) |
| `node show <id>` | Show full node details with edges |
| `node add` | Add a node (`--parent`, `--name`, `--description`, `--keywords`, `--category`) |
| `node update <id>` | Update node fields |
| `node delete <id>` | Delete a leaf node |
| **Edges** | |
| `edge list` | List all edges |
| `edge add` | Add an edge (`--source`, `--target`, `--trust`, `--type`) |
| `edge update <id>` | Update edge trust/type |
| `edge delete <id>` | Delete an edge |
| **Trust** | |
| `trust show` | Show trust values (re-propagates in memory) |
| `trust propagate` | Re-propagate trust and save to file |
| **Search** | |
| `search <query>` | Search nodes by name, description, keywords |
| **Categories** | |
| `category list` | List categories |
| `category add` | Add a category |
| `category update <id>` | Update a category |
| **References** | |
| `ref list` | List references (`--node`, `--review-status` filters) |
| `ref show <id>` | Show full reference details with linked nodes |
| `ref add` | Add a reference (`--title`, `--authors`, `--year`, `--doi`, `--description`) |
| `ref update <id>` | Update reference fields |
| `ref search <query>` | Search references by title, author, DOI, description |
| `ref link <ref-id> <node-id>` | Link reference to node |
| `ref unlink <ref-id> <node-id>` | Unlink reference from node |
| **Review** | |
| `review list` | List items with review status (`--status` filter) |
| `review pending` | List draft/pending-review items |
| `review approve <id>` | Approve a node or reference |
| `review reject <id>` | Reject a node or reference |
| **Hypotheses** | |
| `hypothesis list` | List hypothesis cards (`--status` filter) |
| `hypothesis show <id>` | Show a hypothesis card |
| `hypothesis add` | Add a hypothesis card |
| `hypothesis update <id>` | Update statement/links/score/status |
| `hypothesis triage` | Re-score and prioritize hypothesis cards (`--promote` optional) |
| `hypothesis propose` | Run generator/skeptic/judge loop to propose draft cards |
| **Constraints** | |
| `constraint list` | List constraint edges (`requires`, `confounded-by`, `incompatible-with`, `fails-when`) |
| **Batch** | |
| `batch import` | Import from JSON with publish gate, dedup, provenance, audit trail |
| **Governance** | |
| `governance config` | View/modify governance config (`--show`, `--set key=value`) |
| `governance validate` | Run publish gate validation on current graph |
| `governance audit` | View audit log entries (`--date`, `--today`, `--entity`) |
| `governance stats` | Today's node count, daily cap status |
| **Snapshot** | |
| `snapshot save` | Save a dated snapshot (`--trigger manual\|daily-auto`) |
| `snapshot list` | List all available snapshots |
| `snapshot show <date>` | Show snapshot summary |
| `snapshot diff <date>` | Compare snapshot vs current graph |
| `snapshot rollback <date>` | Rollback to snapshot (`--force` required) |
| **Literature** | |
| `literature search` | Search Semantic Scholar or OpenAlex |
| `literature resolve` | Resolve a DOI to metadata |
| `literature citations` | Get citing/cited-by papers |
| `literature enrich` | Enrich existing reference with external API data |
| **Agent** | |
| `agent status` | Last run, pending items, summary |
| `agent gaps` | Nodes needing references or evidence |
| `agent state` | Raw agent state |
| `agent reset` | Clear agent state |
| `agent config` | View/modify agent configuration |
| `agent discovery status` | Discovery registry summary (events, candidates, status counts) |
| `agent discovery list` | List latest discovery candidates with filters |
| `agent discovery retry <candidate-id>` | Re-queue a discovery candidate |
| `agent discovery ingest` | Run gap/frontier/citation discovery ingestion and append registry events |
| `agent discovery reconcile-state` | Rebuild discovery state counters from registry events |
| `agent claims extract` | Extract claim-level entries from reference abstracts |
| `agent run-note generate` | Generate structured run notes in `vault/agent-runs` |
| `agent contradictions` | Surface mixed support/contradiction evidence for nodes/hypotheses |
| `agent metrics` | Generate daily/weekly/monthly calibration metrics report |
| **Vault** | |
| `vault init` | Initialize Obsidian vault directory |
| `vault sync` | Sync graph to/from vault (`--direction`) |
| `vault status` | Show vault file counts |
| **Import/Export** | |
| `import <dir>` | Import legacy XML data directory |
| `export dot` | Export as Graphviz DOT |
| `export png` | Render as PNG (requires Graphviz) |

Global options: `-f, --file <path>` (default: `./modularpsi.json`), `--format json|table|quiet`

## Data Model

- **Provenance** — Agent-added items track source, agent name, run ID, search query, API source
- **Review status** — `draft` → `pending-review` → `approved` / `rejected`
- **External IDs** — References store DOI, Semantic Scholar ID, OpenAlex ID for deduplication
- **Trust values** — `-1` (unclassified), `0` (falsified), `0.0–1.0` (confidence), `1.0` (certain)
- **Discovery registry** — Candidate exploration events are append-only JSONL files in `research/discovery/YYYY-MM-DD/candidates.jsonl`
- **Candidate identity** — Discovery IDs are deterministic (`doi` → `semanticScholarId` → `openAlexId` → normalized `title+year` hash)
- **Schema migration marker** — `metadata.schemaVersion` is backfilled on load for compatibility-aware upgrades
- **Reference processing lifecycle** — `processingStatus` tracks imported draft / approved / rejected state for references
- **Claim-level extraction** — References can store `claims[]` with direction/context/confidence derived from abstracts
- **Hypothesis cards** — Structured candidate correlations/constraints with support/contradiction links and triage status
- **Constraint edges** — Edge semantics include `requires`, `confounded-by`, `incompatible-with`, and `fails-when`
- **Run notes** — Structured per-run markdown notes can be generated in `vault/agent-runs`
- **Review/processing sync** — Reference `processingStatus` is aligned automatically on review approve/reject actions
- **Governance for hypotheses/constraints** — Daily caps and evidence validation now include hypotheses and constraint-edge publishing
- **Hypothesis duplicate guard** — Governance validation now catches semantic duplicate hypotheses when similar statements target overlapping nodes
- **Decision audit detail** — Hypothesis propose/triage writes decision metadata (`decisionType`, `aiRationale`, `scoreBreakdown`) to audit logs
- **UI review surface** — Side panel now includes a hypothesis review queue and contradiction snapshot when nothing is selected
- **Vault note enrichment** — Synced node/reference markdown now includes hypothesis links and contradiction summaries

## Tech Stack

- **Frontend**: React 19, React Flow, Zustand, Tailwind CSS 4
- **CLI**: Commander.js, tsx
- **Literature APIs**: Semantic Scholar, OpenAlex, CrossRef (all free, no keys needed)
- **Build**: Vite 7, TypeScript 5.9
- **Test**: Vitest

## Development

```bash
npm run dev          # Dev server with HMR
npm test             # Run tests
npm run test:watch   # Watch mode
npm run lint         # ESLint
npm run build        # Production build (typecheck + vite)
```

## License

MIT
