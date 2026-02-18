# Full Program Plan: Multi-Line Psi Discovery, Curation, Constraint Mining, and Review

## Summary
This is the complete, decision-complete roadmap to implement the full system in phases that can be executed independently but integrate cleanly.
Core principle: LLMs propose, structure, and prioritize; humans approve and calibrate.

## Phase 0: Foundation Lock (Schema + Policy)
1. Freeze canonical storage responsibilities.
- Graph JSON: structured entities, edges, statuses, provenance.
- Discovery JSONL ledger: all explored candidates and decisions (append-only).
- Vault markdown: narrative notes and run journals (human/LLM readable).

2. Lock default policies.
- Full abstract retention with checksum.
- Draft-only import for all AI additions.
- Governance/publish gate always enforced (except explicit `--force`).

3. Add versioned schema marker.
- `GraphData.metadata.schemaVersion` and migration hooks in `json-io`.

## Phase 1: Multi-Line Discovery Ingestion
1. Implement discovery lanes.
- Lane A: gap-driven (`agent gaps` seeded queries).
- Lane B: frontier-driven (`focusKeywords`, adjacent methods).
- Lane C: citation snowballing (citing/cited-by from selected anchors).

2. Add discovery registry.
- File path: `research/discovery/YYYY-MM-DD/candidates.jsonl`.
- Append event per candidate lifecycle state change.

3. Add candidate identity + idempotency.
- Stable `candidateId`: DOI > S2 > OpenAlex > normalized title/year hash.
- Track processed IDs in agent state for quick skip.

4. CLI additions.
- `agent discovery status`
- `agent discovery list --date --status --api --query`
- `agent discovery retry --candidate-id <id>`

## Phase 2: Claim-Level Parsing and Normalization
1. Add claim model.
- `Reference.claims[]` with:
  - `claimId`, `text`, `direction` (`supports|contradicts|null`), `contextTags[]`, `confidence`, `rationale`, `extractorModel`, `createdAt`.

2. Implement claim extraction pass.
- Input: queued candidates with abstract/full metadata.
- Output: normalized claims mapped to existing node candidates.

3. Add ontology tagging.
- Controlled tags: phenomenon, mechanism, protocol, population, measurement, confounder, failure-mode.

4. Parse caching.
- Skip reparsing if abstract checksum unchanged unless forced.

## Phase 3: Correlation and Constraint Discovery Engine
1. Add hypothesis card model.
- New collection `hypotheses[]` in graph:
  - `id`, `statement`, `linkedNodeIds`, `supportRefIds`, `contradictRefIds`, `constraintEdgeIds`, `score`, `status`, `createdByRunId`.

2. Implement 3-role LLM loop.
- Generator: proposes candidate cross-links/constraints.
- Skeptic: attacks with confounders, study quality, boundary failures.
- Judge: keeps only cards with explicit support + explicit failure conditions.

3. Add constraint edge semantics.
- Extend edge types:
  - `requires`, `confounded-by`, `incompatible-with`, `fails-when`.
- Ensure parser and CLI accept/display new edge labels.

## Phase 4: Scoring, Ranking, and Triage
1. Implement scoring function per hypothesis.
- Weighted components:
  - replication count
  - method diversity
  - source quality tier
  - contradiction load (negative)
  - recency decay

2. Promotion policy.
- Only top-ranked cards move to `pending-review`.
- Lower confidence stays `draft` with reasons.

3. Contradiction surfacing.
- Per node/hypothesis contradiction summary:
  - direct contradictory claims
  - unresolved conflicts
  - `needs adjudication` flag.

## Phase 5: Governance, Safety, and Audit Deepening
1. Extend governance checks.
- Caps on daily new hypotheses and daily constraint edges.
- Minimum evidence requirement before non-draft promotion.
- Duplicate hypothesis detection by semantic similarity + linked nodes.

2. Audit enhancements.
- Log for every decision: `decisionType`, `reason`, `aiRationale`, `validationErrors`, `scoreBreakdown`.

3. Replayability.
- Every run can be reconstructed from:
  - agent state
  - discovery ledger
  - audit log
  - snapshot.

## Phase 6: Vault-First Knowledge Notes
1. Standardize run-note template in `vault/agent-runs/`.
- Sections:
  - queries run
  - explored counts by status
  - imported drafts
  - proposed hypotheses
  - constraints discovered
  - rejected-near-miss list
  - next-run seeds

2. Node/reference note enrichments.
- Keep `## Notes` and `## Reading Notes` preserved.
- Add links to hypothesis cards and contradiction summaries.

3. Sync rules.
- Vault remains narrative source-of-truth.
- Graph remains structured source-of-truth.
- No automatic overwriting of narrative sections.

## Phase 7: UI and CLI Productization
1. CLI command set additions.
- `hypothesis list/show/add/update`
- `hypothesis triage --top <n>`
- `constraint list`
- `agent contradictions`
- `agent run-note generate`

2. UI enhancements.
- Filter by discovery status, hypothesis status, contradiction severity.
- Show constraint edges distinctly.
- Hypothesis review panel with support vs contradiction evidence.

## Phase 8: Evaluation and Continuous Calibration
1. Daily cycle.
- Discover -> parse -> score -> import drafts -> vault sync -> status report.

2. Weekly cycle.
- Review pending drafts/hypotheses.
- Snapshot diff and contradiction audit.

3. Monthly cycle.
- Ontology refinement.
- False-positive analysis.
- Re-weight scoring function based on reviewer outcomes.

4. Metrics dashboard.
- Precision proxy: approved / proposed.
- Novelty proxy: approved hypotheses with cross-category links.
- Stability proxy: hypotheses surviving 30/60/90 days.
- Throughput: candidates processed per run.

## Public API / Type Changes (Consolidated)
1. `DiscoveryCandidate` (new).
2. `AgentState` extensions:
- processed IDs, cursor-by-query-api, discovery stats.
3. `Reference` extensions:
- abstractChecksum, discoveryCandidateId, processingStatus, claims[].
4. `GraphData` extension:
- `hypotheses[]`.
5. `EdgeType` extension:
- `requires|confounded-by|incompatible-with|fails-when`.
6. Optional `EvidenceTier` and `RiskOfBias` enums for scoring.

## Test Plan
1. Identity/idempotency.
- Stable candidate IDs across runs and sources.
2. Dedup.
- DOI/S2/OpenAlex and fuzzy matching precedence.
3. Claim extraction.
- Deterministic parsing snapshot tests for representative abstracts.
4. Hypothesis loop.
- Generator/skeptic/judge integration tests with fixed fixtures.
5. Constraint edges.
- Create/update/list/render for all new edge types.
6. Governance.
- Cap and required-field enforcement for hypotheses/constraints.
7. Notes.
- Vault run-note generation and section preservation tests.
8. End-to-end.
- Gap -> discovery -> parsing -> hypothesis proposal -> review queue.

## Rollout Sequence (Execution Milestones)
1. Milestone 1: Phase 1 + registry + CLI discovery status.
2. Milestone 2: Phase 2 claim extraction with checksum reparse logic.
3. Milestone 3: Phase 3 hypothesis cards + new constraint edges.
4. Milestone 4: Phase 4 scoring + triage workflows.
5. Milestone 5: Phase 6 vault run notes + UI review panels.
6. Milestone 6: Phase 8 metrics and calibration loops.

## Assumptions and Defaults
1. Human review is mandatory for any approval.
2. Full abstracts are permissible for local storage.
3. Discovery registry is append-only, never rewritten.
4. Existing governance/audit/snapshot structure remains and is extended, not replaced.
5. Backward compatibility maintained via schema version and migration layer.

