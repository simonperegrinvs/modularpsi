#!/bin/bash
# Phase B, Step 7: Add cross-links (non-tree DAG edges)
set -e

CLI="npx tsx src/cli/index.ts"
F="-f $HOME/data/modularpsi/psi-literature.json"
FMT="--format quiet"

cross() {
  echo "Adding $1 -> $2"
  $CLI $F $FMT edge add --source "$1" --target "$2" --trust "$3" --type "$4" 2>&1 || true
}

echo "=== Adding Cross-Links ==="

# These may already exist from partial run — || true handles duplicates

# TSVF -> Precognition/Presentiment (TSVF provides theoretical basis for precognition)
cross P24 P9 0.4 derivation

# Publication Bias -> Ganzfeld Evidence (pub bias weakens ganzfeld claims)
cross P50 P6 0.6 implication

# Microtubules -> Non-Local Correlation (quantum biology as interface)
cross P34 P17 0.3 derivation

# Observational Theory -> Retro-PK (OT explains retro-PK)
cross P32 P12 0.3 implication

# Sensory Noise Reduction -> Ganzfeld Evidence (SNR is rationale for ganzfeld)
cross P40 P6 0.5 derivation

# Belief/Sheep-Goat -> Ganzfeld Evidence (belief moderates ganzfeld)
cross P81 P6 0.4 implication

# Confirmation Bias -> Ganzfeld Evidence (alternative explanation)
cross P57 P6 0.5 implication

# Selective Reporting -> Bem Precognition (alternative explanation for Bem)
cross P51 P10 0.7 implication

# File Drawer -> Micro-PK (file drawer explains PK results)
cross P62 P14 0.6 implication

# Quantum Non-Locality -> Orch-OR (QM underpins Orch-OR)
cross P18 P35 0.6 derivation

# Experimenter Effect -> Remote Viewing (demand characteristics concern)
cross P52 P7 0.5 implication

# Sensory Leakage -> Autoganzfeld Protocol (historical concern, autoganzfeld addresses it)
cross P53 P67 0.4 implication

# Altered States -> Ganzfeld (altered state is part of ganzfeld methodology)
cross P45 P6 0.4 derivation

# No-Signaling constrains Signal Theories
cross P19 P27 0.8 implication

# Hard Problem motivates Consciousness-Based Frameworks
cross P87 P48 0.5 derivation

echo ""
echo "=== Re-propagating Trust ==="
$CLI $F trust propagate

echo ""
echo "=== Verification ==="
echo -n "Total nodes: "
$CLI $F node list --format quiet 2>/dev/null | wc -l | tr -d ' '
echo -n "Total edges: "
$CLI $F edge list --format quiet 2>/dev/null | wc -l | tr -d ' '
echo -n "Total references: "
$CLI $F ref list --format quiet 2>/dev/null | wc -l | tr -d ' '
echo ""
echo "Trust summary (first 30):"
$CLI $F trust show --format table 2>/dev/null | head -32

echo ""
echo "=== Exporting DOT ==="
$CLI $F export dot > ~/data/modularpsi/psi-literature.dot 2>/dev/null
echo "DOT export saved to ~/data/modularpsi/psi-literature.dot"
echo "Graph build complete."
