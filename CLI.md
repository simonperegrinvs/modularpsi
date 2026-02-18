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

### node list

List all nodes in the graph.

```
npm run mpsi -- node list
```

**Output fields:** `id`, `name`, `trust`, `type`, `category`

### node show \<id\>

Show full details for a node, including its outgoing edges.

```
npm run mpsi -- node show P1
```

**Output fields:** `id`, `name`, `description`, `categoryId`, `keywords`, `type`, `trust`, `referenceIds`, `edges[]`

### node add

Add a new node connected to a parent.

```
npm run mpsi -- node add --parent P1 --name "Telepathy evidence"
npm run mpsi -- node add --parent P1 --name "Options" --type chooser --category bio
npm run mpsi -- node add --parent P1 --name "Hypothesis with summary" --description "Short explanation" --require-description
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--parent <id>` | Yes | Parent node ID | |
| `--name <name>` | Yes | Node name | |
| `--type <type>` | No | `regular`, `chooser`, or `holder` | `regular` |
| `--category <cat>` | No | Category ID | `general` |
| `--description <desc>` | No | Node description | `""` |
| `--require-description` | No | Fail if `--description` is empty | `false` |

**Output fields:** `id`, `name`

The new edge gets trust=-1 (unclassified). Trust is re-propagated after adding.

### node update \<id\>

Update one or more fields on an existing node.

```
npm run mpsi -- node update P2 --name "Updated name" --description "New desc"
npm run mpsi -- node update P2 --keywords "telepathy;evidence;meta-analysis"
npm run mpsi -- node update P2 --type chooser
npm run mpsi -- node update P2 --description-file ./notes/p2.txt
```

| Option | Description |
|--------|-------------|
| `--name <name>` | New name |
| `--description <desc>` | New description |
| `--description-file <path>` | Read new description from a file |
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

List all references, optionally filtered by node.

```
npm run mpsi -- ref list
npm run mpsi -- ref list --node P3
```

### ref add

Add a new reference with optional evidence metadata.

```
npm run mpsi -- ref add --title "Study of Psi" --authors "Smith;Jones" --year 2020
npm run mpsi -- ref add --title "Ganzfeld RR" --study-type "meta-analysis" --effect-direction "supports" --quality-score 0.85
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--title <title>` | Yes | Reference title | |
| `--authors <authors>` | No | Semicolon/comma-separated author names | `""` |
| `--year <year>` | No | Publication year | `0` |
| `--publication <publication>` | No | Journal/publication name | `""` |
| `--publisher <publisher>` | No | Publisher | `""` |
| `--citation <citation>` | No | Full citation text | `""` |
| `--doi <doi>` | No | DOI string | |
| `--url <url>` | No | URL | |
| `--abstract <abstract>` | No | Brief abstract/notes | |
| `--study-type <type>` | No | `meta-analysis`, `replication`, `rct`, `observational`, `review`, `theory` | |
| `--domain-tags <tags>` | No | Semicolon/comma-separated tags | |
| `--quality-score <0..1>` | No | Evidence quality score | |
| `--effect-direction <dir>` | No | `supports`, `null`, `challenges`, `mixed` | |
| `--replication-status <status>` | No | `single`, `independent-replication`, `failed-replication`, `multi-lab` | |

### ref update \<id\>

Update reference metadata.

```
npm run mpsi -- ref update ref-123 --quality-score 0.9 --effect-direction supports
```

### ref import

Import references from CSV.

```
npm run mpsi -- ref import --csv ./references.csv
npm run mpsi -- ref import --csv ./references.csv --require-node-description
```

Supported CSV headers: `id,title,authors,year,publication,publisher,citation,pageStart,pageEnd,volume,doi,url,abstract,studyType,domainTags,qualityScore,effectDirection,replicationStatus,nodeIds`.

`nodeIds` can include semicolon/comma-separated node IDs to auto-link each imported reference.
Use `--require-node-description` to fail import if any linked node has an empty description.

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

### hypothesis rank

Rank hypotheses using propagated trust + evidence metadata.

```
npm run mpsi -- hypothesis rank --top 20
npm run mpsi -- hypothesis rank --include-unreferenced --format table
```

Output fields include: `id`, `name`, `trust`, `evidenceCount`, `evidenceScore`, `rankScore`, and direction counts.

### report brief

Generate concise hypothesis briefs with top linked references.

```
npm run mpsi -- report brief --top 10 --max-refs 4 --format json
npm run mpsi -- report brief --node P13 --markdown
```

Brief output includes node descriptions when available.

---

### discover run

Run AI-assisted literature discovery from free/open APIs and write artifacts to vault.

```
npm run mpsi -- discover run
npm run mpsi -- discover run --vault ~/data/modularpsi --max-queries 20 --per-source 8
npm run mpsi -- discover run --dry-run
npm run mpsi -- discover run --strict --max-new-refs 150 --max-new-nodes 20 --max-trust-delta 0.35
```

Sources queried: OpenAlex, Semantic Scholar, CrossRef, arXiv.

Default vault base folder: `~/data/modularpsi`

Artifacts written under: `~/data/modularpsi/runs/<date>/`

Key options:

- `--strict` / `--no-strict`: enable/disable hard validation checks (default: strict on)
- `--max-new-refs <n>`: per-run cap for applied references
- `--max-new-nodes <n>`: guard rail for proposed node creation
- `--max-trust-delta <n>`: guard rail for maximum trust drift in one run

### snapshot create

Create an immutable graph snapshot under the vault.

```
npm run mpsi -- snapshot create
npm run mpsi -- snapshot create --label before-discovery
```

### snapshot list

List available snapshots in the vault.

```
npm run mpsi -- snapshot list --format table
```

### snapshot rollback \<snapshot\>

Restore current graph file from a vault snapshot.

```
npm run mpsi -- snapshot rollback psi-map-20260218T181500Z.json
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

### Reference Metadata

References support extra evidence fields for ranking/reporting:

- `doi`, `url`, `abstract`
- `studyType`, `domainTags`
- `qualityScore` (0..1)
- `effectDirection` (`supports|null|challenges|mixed`)
- `replicationStatus` (`single|independent-replication|failed-replication|multi-lab`)

### Default Categories

| ID | Name |
|----|------|
| `general` | General Aspects of Psi |
| `bio` | Fisiological Aspects of Psi |
| `physical` | Physical Aspects of Psi |
| `psichological` | Psychological Aspects of Psi |
| `cultural` | Cultural Aspects of Psi |
| `na` | N/C |

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
npm run mpsi -- hypothesis rank --top 10
npm run mpsi -- report brief --top 5 --markdown
```
