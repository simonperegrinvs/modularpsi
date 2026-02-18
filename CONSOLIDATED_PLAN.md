# Consolidated Plan: ModularPsi Expansion, Governance, and Visualization

## Summary
This plan consolidates the agreed direction for:

1. Backfilling missing descriptions on newly added research nodes.
2. Running continuous AI-driven literature discovery without paid/restricted sources.
3. Managing graph growth with audit controls, deduplication, ranking, and scalable visualization.

Primary operating choices:

- Cadence: **Daily incremental**
- Publish mode: **Auto-publish with audits**
- Visualization strategy: **Layered clusters**
- Discovery stack: **OpenAlex + Semantic Scholar + CrossRef + arXiv**

---

## Phase 1: Backfill Missing Node Descriptions

### Goal
Ensure newly added research nodes are interpretable in isolation and searchable by description.

### Required updates
Backfill descriptions for nodes `P47` through `P61` in `research/psi-map-2026.json`.

Recommended text:

- `P47`: Umbrella hypothesis that psi-like effects, if real, are weak, probabilistic, and highly dependent on participant selection, protocol quality, and context.
- `P48`: Represents Ganzfeld evidence indicating a small aggregate positive effect under some designs, with substantial debate about robustness and moderators.
- `P49`: Represents presentiment claims where pre-stimulus physiology appears to anticipate random future stimuli, with unresolved artifact concerns.
- `P50`: Represents RNG micro-PK findings of very small effects with sensitivity to study design, publication bias, and replication quality.
- `P51`: Represents nonlocal models constrained by no-signaling: correlation-like effects without controllable faster-than-light information transfer.
- `P52`: Represents the claim that preregistration, blinding, randomization quality, and transparency strongly modulate observed effect size.
- `P53`: Represents field-level inflation risks from selective reporting, flexible analyses, and publication bias in weak-signal literatures.
- `P54`: Represents conventional expectation/order/preprocessing artifacts that can mimic anticipatory or anomalous effects.
- `P55`: Represents cognitive mechanisms (illusory control, reasoning errors) that increase anomalous interpretation without anomalous transfer.
- `P56`: Represents memory distortion and ontological confusion pathways associated with stronger paranormal belief.
- `P57`: Represents the empirical pattern of null or near-null outcomes in many high-powered and transparent replications.
- `P58`: Represents physical constraints (attenuation, shielding, energetic plausibility, gravity-speed bounds) on classical signal-carrier psi models.
- `P59`: Represents the distinction that Bell nonlocality supports nonlocal correlations but not controllable signaling channels.
- `P60`: Represents retrocausal/precognition claims weighed against modern replication failures and statistical critiques.
- `P61`: Represents holographic/holorresonance-style frameworks as heuristic organizing models pending stronger discriminative predictions.

---

## Phase 2: Metadata Enforcement for Future Additions

### Goal
Prevent low-context graph growth and ensure AI-added entities are reviewable.

### CLI requirements
- Extend `node add` with `--description`.
- Add validation mode (`--require-description`) to fail empty descriptions.
- Add optional `node update --description-file <path>` for long descriptions.
- Extend `ref import` with `--require-node-description` when linking by `nodeIds`.
- Include node description text in `report brief`.

### UI requirements
- Show warning badge for nodes with empty description.
- Add metadata completeness indicator per node:
  - description present
  - keywords present
  - references linked
- Add hover preview with short description snippet.

---

## Phase 3: Daily AI-Driven Discovery (No Curated Paid Sources)

### Goal
Continuously expand literature coverage using free/open APIs and graph-native query generation.

### Data sources (free only)
- Semantic Scholar (abstracts, metadata, citations)
- OpenAlex (broad discovery backbone)
- CrossRef (DOI resolution and canonical metadata)
- arXiv (preprints)

### Discovery flow
1. **Seed generation from graph**
   - Generate search intents from node names, descriptions, keywords, linked references.
2. **Harvest**
   - Query all four sources with rate-aware scheduling.
3. **Normalize**
   - Canonicalize title/DOI/authors/year/source IDs.
4. **Deduplicate**
   - DOI exact, source-ID exact, fuzzy title+year+author fallback.
5. **AI classify**
   - `in-scope-core`, `in-scope-adjacent`, `out-of-scope`.
6. **AI mapping**
   - Map to existing node(s) with confidence.
   - Create new node only when novelty threshold is exceeded.
7. **Apply**
   - Add refs, link refs to nodes, optionally add nodes/edges.
8. **Recompute**
   - `trust propagate`, `hypothesis rank`, `report brief`.
9. **Audit and snapshot**
   - Persist logs and daily immutable snapshot.

### Throughput defaults
- 120 node-intent queries/day
- 25 citation-snowball expansions/day
- 2,500 raw candidates/day max

### Resilience defaults
- Exponential backoff retries (max 3)
- Partial-source tolerance (continue if one API fails)

---

## Phase 4: Auto-Publish Governance and Audit Controls

### Goal
Allow fast growth while preserving traceability and rollback safety.

### Hard checks before publish
- Reject new node with empty description.
- Reject reference without title + year + DOI/URL.
- Enforce duplicate rejection:
  - DOI exact
  - canonical source ID exact
  - fuzzy fallback threshold
- Cap daily new nodes (default: 20 unless override).
- Cap daily trust delta per node.

### Audit trail
Write append-only JSONL log per day:

- timestamp
- action
- entity type/id
- source APIs
- AI rationale
- mapping confidence
- before/after
- validation outcomes

### Snapshot and rollback
- Save daily immutable graph snapshots.
- Provide rollback command by date.

---

## Phase 5: Visualization Management for Graph Growth

### Goal
Keep graph readable as node/edge volume scales.

### Primary strategy: Layered clusters
- Cluster by family:
  - core psi signal
  - methodological artifacts
  - physics constraints
  - cognitive explanations
  - replication outcomes

### Required controls
- Collapse/expand clusters.
- Filter by:
  - effect direction
  - study type
  - replication status
  - date range
  - source API
- Edge threshold slider (hide low-trust edges).
- Focus mode (k-hop ego graph).
- “Recent changes” overlay (nodes/edges changed in last N days).

### Layout stability
- Keep dynamic node sizing and non-overlap guarantees.
- Preserve manual positions when user pins nodes.
- Re-layout only affected cluster/subgraph where possible.

---

## Interfaces and Type Additions

### Node
- `createdBy?: "human" | "ai"`
- `updatedAt?: string`
- `status?: "active" | "stale" | "merged"`

### Reference
- `sourceApis?: string[]`
- `externalIds?: { doi?: string; openAlex?: string; semanticScholar?: string; arxiv?: string }`
- `ingestedAt?: string`
- `aiSummary?: string`
- `aiConfidence?: number`
- `mappingConfidence?: number`
- `sourceAliases?: string[]`

---

## Testing and Acceptance

### Functional
- Node description enforcement fails on empty description.
- Import pipeline rejects malformed refs.
- Dedup merges multi-source duplicate works correctly.
- Mapping chooses existing nodes when novelty is low.

### Quality and governance
- Every applied change has audit log entries.
- Daily snapshot can be restored exactly.
- Drift guard catches abnormal trust jumps.

### Visualization
- Large synthetic graph remains navigable with clusters/filters.
- Cluster collapse materially reduces visible edge density.
- Focus mode isolates local reasoning neighborhood cleanly.

---

## Operational Outputs

Generated daily artifacts (example structure):

- `research/runs/YYYY-MM-DD/discovery-candidates.json`
- `research/runs/YYYY-MM-DD/discovery-applied.json`
- `research/runs/YYYY-MM-DD/audit.jsonl`
- `research/runs/YYYY-MM-DD/hypothesis-rank.json`
- `research/runs/YYYY-MM-DD/evidence-brief.md`
- `research/snapshots/psi-map-YYYY-MM-DD.json`

---

## Notes
- No paid/restricted databases are required.
- AI remains the discovery engine; governance mechanisms keep quality and provenance intact.
- This plan assumes the current graph and CLI are the canonical platform for ongoing expansion.
