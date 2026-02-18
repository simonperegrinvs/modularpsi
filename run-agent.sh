#!/bin/bash
# Daily automated discovery/import loop for the psi knowledge graph.
# Usage: ./run-agent.sh
# Cron example:
#   0 8 * * * /Users/simon/projects/modularpsi/run-agent.sh >> /Users/simon/data/modularpsi/runs/daily.log 2>&1

set -uo pipefail

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

FAILURES=0
FAILED_STEPS=()

run_step() {
  local step_name="$1"
  shift

  echo
  echo "==> $step_name"
  if "$@"; then
    echo "<== $step_name: ok"
    return 0
  fi

  local code=$?
  FAILURES=$((FAILURES + 1))
  FAILED_STEPS+=("${step_name} (exit ${code})")
  echo "<== $step_name: failed (exit ${code})"
  return 0
}

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

run_discovery_ingest_with_apis() {
  local -a apis=("$@")
  "${CLI[@]}" --format json agent discovery ingest \
    --run-id "$RUN_ID" \
    --api "${apis[@]}" \
    --auto-import \
    --import-limit 20 \
    --import-review-status draft \
    --scope-keyword "psi" "ganzfeld" "remote viewing" "precognition" "psychokinesis" "presentiment" \
    --exclude-keyword "microbial" "radiocarbon" "land surface temperature" "airbnb" "gene expression" \
    --min-scope-score 3 \
    "${NODE_GROWTH_FLAGS[@]}"
}

run_discovery_ingest() {
  if run_discovery_ingest_with_apis semantic-scholar openalex; then
    return 0
  fi
  echo "Primary discovery ingest failed. Retrying with OpenAlex only."
  run_discovery_ingest_with_apis openalex
}

# Enrich identity fields for references (DOI/URL/IDs) where possible.
run_step "Discovery ingest + auto-import" run_discovery_ingest
run_step "Reference enrichment" "${CLI[@]}" --format json literature enrich --all --api openalex --limit 5

# Extract claims, score hypotheses, and generate daily run note.
run_step "Claim extraction" "${CLI[@]}" --format json agent claims extract
run_step "Hypothesis propose" "${CLI[@]}" --format json hypothesis propose --top 10 --run-id "$RUN_ID"
run_step "Hypothesis triage" "${CLI[@]}" --format json hypothesis triage --top 10 --min-score 0.35 --promote
run_step "Run-note generation" "${CLI[@]}" --format json agent run-note generate --path "$VAULT" --run-id "$RUN_ID" --date "$DATE"

# Governance gate and summary status.
run_step "Governance validate" "${CLI[@]}" --format json governance validate
run_step "Weekly metrics" "${CLI[@]}" --format json agent metrics --period weekly
run_step "Agent status" "${CLI[@]}" --format json agent status

echo
if [[ "$FAILURES" -gt 0 ]]; then
  echo "Run completed with ${FAILURES} failed step(s):"
  printf ' - %s\n' "${FAILED_STEPS[@]}"
  exit 1
fi

echo "Run completed successfully: $RUN_ID"
