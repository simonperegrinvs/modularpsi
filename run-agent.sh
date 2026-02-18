#!/bin/bash
# Daily literature scan agent for psi-literature knowledge graph
# Usage: ./run-agent.sh
# Cron:  0 8 * * * /Users/simon/projects/modularpsi-psi-literature/run-agent.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
GRAPH="$HOME/data/modularpsi/psi-literature.json"
VAULT="$HOME/data/modularpsi/vault"
AUDIT="$HOME/data/modularpsi"

cd "$DIR"

claude -p "You are a literature scanning agent for a psi phenomena knowledge graph.

Graph file: $GRAPH
Vault path: $VAULT
Audit dir: $AUDIT
CLI: npm run mpsi -- -f $GRAPH

Run this cycle:

1. Run 'npm run mpsi -- -f $GRAPH agent gaps' to find nodes that need references or evidence.

2. Pick the top 5-10 gaps (prioritize nodes with highest trust but no references). For each, run:
   npm run mpsi -- literature search --query \"<node name + keywords>\" --limit 10

3. Evaluate the search results for relevance. Classify each as in-scope-core, in-scope-adjacent, or out-of-scope. Discard out-of-scope results.

4. Build a batch import JSON file at /tmp/psi-scan-\$(date +%Y%m%d).json with:
   - references: title, authors, year, doi, description, abstract, semanticScholarId, linkToNodes
   - No new nodes unless a result clearly represents a novel sub-topic not yet in the graph
   - provenance: include searchQuery and apiSource for each

5. Run: npm run mpsi -- -f $GRAPH batch import --input /tmp/psi-scan-\$(date +%Y%m%d).json --review-status draft --snapshot --audit-dir $AUDIT

6. Run: npm run mpsi -- -f $GRAPH vault sync --path $VAULT

7. Run: npm run mpsi -- -f $GRAPH agent status

8. Git add and commit the changes (graph file only, not vault) with a message summarizing what was found.

Rules:
- All imported content gets review-status=draft (never auto-approve)
- Do NOT assign trust values to edges (that is for human review)
- Stay within the graph's existing keyword scope
- Respect rate limits (1 second between API calls)
- If an API fails, skip it and continue with others
" --allowedTools Bash,Read,Write
