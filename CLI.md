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
| `--type <type>` | No | `implication`, `derivation`, or `possibility` | `implication` |

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
| `--type <type>` | New edge type |

### edge delete \<id\>

Delete an edge. Fails if the target node would be disconnected (must have 2+ incoming edges).

```
npm run mpsi -- edge delete P1-P3
```

---

### trust show

Show propagated trust values for all nodes or a specific node.

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

### review reject \<id\>

Reject a node or reference.

```
npm run mpsi -- review reject P5
```

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
