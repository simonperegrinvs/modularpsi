#!/bin/bash
# Daily automated discovery/import loop for the psi knowledge graph.
# Usage: ./run-agent.sh
# Cron example:
#   0 8 * * * /Users/simon/projects/modularpsi/run-agent.sh >> /Users/simon/data/modularpsi/runs/daily.log 2>&1

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
GRAPH="${GRAPH:-$HOME/data/modularpsi/psi-literature.json}"
VAULT="${VAULT:-$HOME/data/modularpsi/vault}"
RUN_ID="${RUN_ID:-daily-auto-$(date +%Y%m%d-%H%M%S)}"
DATE="$(date +%F)"
RUN_MODE="${RUN_MODE:-real}" # real|smoke
CLI=(npm run mpsi -- -f "$GRAPH")

cd "$DIR"

echo "Starting run: $RUN_ID"
echo "Graph: $GRAPH"
echo "Vault: $VAULT"
echo "Run mode: $RUN_MODE"

NODE_GROWTH_FLAGS=()
if [[ "$RUN_MODE" == "real" ]]; then
  NODE_GROWTH_FLAGS=(
    --auto-node-growth
    --max-new-nodes 2
    --min-node-confidence 0.78
    --node-review-status approved
    --node-similarity-threshold 0.85
  )
fi

# Discover and auto-import draft references using scope filtering.
"${CLI[@]}" --format json agent discovery ingest \
  --run-id "$RUN_ID" \
  --api semantic-scholar openalex \
  --auto-import \
  --import-limit 20 \
  --import-review-status draft \
  --scope-keyword "psi" "ganzfeld" "remote viewing" "precognition" "psychokinesis" "presentiment" \
  --exclude-keyword "microbial" "radiocarbon" "land surface temperature" "airbnb" "gene expression" \
  --min-scope-score 3 \
  "${NODE_GROWTH_FLAGS[@]}"

# Enrich identity fields for references (DOI/URL/IDs) where possible.
"${CLI[@]}" --format json literature enrich --all --api openalex --limit 5

# Extract claims, score hypotheses, and generate daily run note.
"${CLI[@]}" --format json agent claims extract
"${CLI[@]}" --format json hypothesis propose --top 10 --run-id "$RUN_ID"
"${CLI[@]}" --format json hypothesis triage --top 10 --min-score 0.35 --promote
"${CLI[@]}" --format json agent run-note generate --path "$VAULT" --run-id "$RUN_ID" --date "$DATE"

# Governance gate and summary status.
"${CLI[@]}" --format json governance validate
"${CLI[@]}" --format json agent metrics --period weekly
"${CLI[@]}" --format json agent status
echo "Run completed: $RUN_ID"
