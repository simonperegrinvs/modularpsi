# 2026 Psi Literature Map (CLI Workflow)

This folder contains a CLI-built research map that extends the legacy graph with modern psi and adjacent constraint literature.
Daily discovery runs are designed to persist operational artifacts in vault base folder `~/data/modularpsi`.

## Artifacts

- `psi-map-2026.json`: main graph with expanded hypotheses + linked references.
- `hypothesis-rank-2026.json`: evidence-weighted ranking output.
- `psi-evidence-brief-2026.md`: human-readable brief (references + short descriptions).
- `psi-evidence-brief-2026.json`: structured brief output.
- `refs_2026.csv`: batch import source for added references.
- `psi-map-2026.dot`: Graphviz export.

## Rebuild From Scratch

```bash
# 1) Start from legacy data
npm run mpsi -- -f research/psi-map-2026.json import legacy/data

# 2) Add/adjust hypotheses (sample commands)
npm run mpsi -- -f research/psi-map-2026.json node add --parent P3 --name "Context-Dependent Anomalous Cognition"
# ... additional node/edge updates in session history

# 3) Import modern references + auto-links
npm run mpsi -- -f research/psi-map-2026.json ref import --csv research/refs_2026.csv

# 4) Recompute trust and rank
npm run mpsi -- -f research/psi-map-2026.json trust propagate
npm run mpsi -- -f research/psi-map-2026.json hypothesis rank --top 30 --format json > research/hypothesis-rank-2026.json

# 5) Generate briefs
npm run mpsi -- -f research/psi-map-2026.json report brief --top 12 --max-refs 4 --markdown > research/psi-evidence-brief-2026.md
npm run mpsi -- -f research/psi-map-2026.json report brief --top 12 --max-refs 4 --format json > research/psi-evidence-brief-2026.json

# 6) Optional graph export
npm run mpsi -- -f research/psi-map-2026.json export dot > research/psi-map-2026.dot

# 7) Optional daily discovery run (writes to ~/data/modularpsi)
npm run mpsi -- -f research/psi-map-2026.json discover run
npm run mpsi -- -f research/psi-map-2026.json discover run --strict --max-new-refs 150 --max-new-nodes 20
```

## Interface Upgrades Used

- Rich reference metadata via `ref add` / `ref update` / `ref import`:
  - `doi`, `url`, `abstract`, `studyType`, `domainTags`, `qualityScore`, `effectDirection`, `replicationStatus`.
- Evidence-weighted ranking via:
  - `hypothesis rank`
- Human-readable evidence summaries via:
  - `report brief`
