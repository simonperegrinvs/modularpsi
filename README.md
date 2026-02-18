# ModularPsi

Knowledge graph editor for tracking and evaluating scientific evidence. Build directed acyclic graphs where trust values propagate from root propositions through evidence chains.

## Features

- **Web UI** — Interactive graph editor built with React Flow, with drag-and-drop layout, node/edge editing, and real-time trust visualization
- **CLI** — Full command-line interface for scripting and AI agent integration (`npm run mpsi -- <command>`)
- **Trust propagation** — Automatic DFS-based trust calculation from root through edge weights
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
npm run mpsi -- node list                     # List all nodes
npm run mpsi -- node add --parent P1 --name "My Node"
npm run mpsi -- edge add --source P1 --target P2 --trust 0.8
npm run mpsi -- trust show                    # Show propagated trust values
```

See [CLI.md](CLI.md) for complete CLI documentation.

## CLI Command Reference

| Command | Description |
|---------|-------------|
| `init` | Create a new empty graph file |
| `node list` | List all nodes |
| `node show <id>` | Show full node details |
| `node add` | Add a new node (requires `--parent`, `--name`) |
| `node update <id>` | Update node fields |
| `node delete <id>` | Delete a leaf node |
| `edge list` | List all edges |
| `edge add` | Add a new edge (requires `--source`, `--target`) |
| `edge update <id>` | Update edge trust/type |
| `edge delete <id>` | Delete an edge |
| `trust show` | Show trust values for all nodes |
| `trust propagate` | Re-propagate and save trust values |
| `search <query>` | Search nodes by name, description, keywords |
| `category list` | List categories |
| `category add` | Add a category |
| `category update <id>` | Update a category |
| `ref list` | List references |
| `ref add` | Add a reference |
| `ref update <id>` | Update reference metadata |
| `ref import --csv <file>` | Import references from CSV |
| `ref link <ref-id> <node-id>` | Link reference to node |
| `ref unlink <ref-id> <node-id>` | Unlink reference from node |
| `hypothesis rank` | Evidence-weighted hypothesis ranking |
| `report brief` | Generate concise evidence briefs |
| `import <dir>` | Import legacy XML data directory |
| `export dot` | Export as Graphviz DOT |
| `export png` | Render as PNG (requires Graphviz) |

Global options: `-f, --file <path>` (default: `./modularpsi.json`), `--format json|table|quiet`

## Tech Stack

- **Frontend**: React 19, React Flow, Zustand, Tailwind CSS 4
- **CLI**: Commander.js, tsx
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
