# ADR-20: Probe self-description layer + deterministic floors [Proposed]

- **Status:** Proposed
- **Date:** 2026-07-23

> **Read first:** [ADR-550](550-spec-phase-probe-contract.md) — this ADR *refines* the spec-phase probe
> contract (it does not replace it); and [ADR-857](857-capability-system.md) §147 — the verifier↔predicate
> substrate boundary that keeps this work **core**, not a Feature Capability.

> **Provenance.** Drafted from two `/gsd-explore` passes (2026-07-23): pass 1 mapped the probe family's
> missing self-description; pass 2 widened the lens across gsd-core and ran an adversarial + `skills-from-the-artificer`
> review. Both were re-verified live at `origin/next @ a5180d96`. **Fork-staged** on
> `davesienkowski/gsd-core` (epic #20) for iteration; the number here tracks that fork issue and is to be
> **renumbered to the open-gsd issue#** on upstream re-file. Not yet endorsed by the maintainer — see *Why still
> Proposed*.

> **Lineage.** The value framing is the verifier-reach thesis ADR-857 §147 names ("verifier reach = spec reach")
> and ADR-550 D6 pins: a probe makes an omitted assertion *exist* before code, extending the verifier's reach.
> Pass 2's cross-cutting finding — that the probe *pattern* already recurs in two un-codified "shadow" subsystems
> — is what distinguishes this from a within-family tidy-up: the self-description layer is what makes *promoting*
> a shadow cheap, later.

## Why this is still `Proposed`

Fork-staged and unshipped: only child 1 (edge `autoResolve`) is built (fork PR #22). The contract (`ProbeDescriptor`),
registry, manifest, and command are unimplemented; the maintainer has not endorsed the epic. Ratify to `Accepted`
with a dated evidence section once the descriptor + registry (child 2) and manifest (child 3) merge upstream.

## Context

`spec-phase` surfaces spec gaps through **probes** (ADR-550 D7): soft-gate steps that make an omitted, checkable
assertion exist before code. Three adapters ship over a shared `probe-core`: **edge** (data/behavior-shape axis),
**prohibition** (must-NOT axis), **ui-consideration** (UI-state axis). Grounding against the tree surfaced the
decisive facts:

- **The family has no code self-description.** Nothing enumerates the axes or answers "what does each classify?"
  The only place naming all three together is a prose predicate (`CONTEXT.md:416`). Each taxonomy lives as a
  `src/*.cts` constant (`edge-probe.cts:85` `TAXONOMY`, `ui-consideration-probe.cts:99` `UI_TAXONOMY`) re-described
  by hand in a prose reference doc — a drift surface (`ui-consideration-probe.cts:128` already flags one
  `CONTEXT.md` typo). `probe-core.cts:663` records the deferred dispatcher in-code.
- **Deferred, not novel (ADR-550 D7e).** A single dispatcher CLI was explicitly deferred as "pure invocation
  plumbing with no migration debt." The `probe run/list/describe` command is the *earned realization* of D7e.
- **A load-bearing floor is prose in 3 of 4 places it appears.** The invariant *"a missing item is not evidence of
  the good state"* (never auto-dismiss / never rubber-stamp an empty artifact) is code-enforced only in ui
  (`ui-consideration-probe.cts:294` `autoResolve`); it is prose in edge (`spec-phase.md:314-324`), in the **STRIDE
  threat register** (`secure-phase.md:85`), and in **eval failure-modes** (`gsd-eval-planner.md:144`). The latter
  two are *shadow-probes*: the probe shape (closed/open taxonomy → propose-from-artifact → classify → never-dismiss
  floor → tier-routed disposition) without the `probe-core` seam.
- **Prohibition is bimodal (ADR-1606).** It runs at spec time (LLM recall) *and* verify time (the
  `check prohibition-enforcement` producer, `dispositionForProhibition`) — the only axis wired end-to-end; edge/ui
  reach the verifier only indirectly via SPEC truths projection.

## Decision

### 1. `ProbeDescriptor` — each adapter self-describes as runtime-validated data

Each adapter exports a `ProbeDescriptor`: plain, JSON-serializable data
(`{axis, title, invoke, proposeKind, relevance|null, taxonomy|null, verificationTiers}`) *referencing* its existing
constants — `verificationTiers` is composed from the adapter's `*_VALIDATORS.verification`, taxonomy is mapped from
`TAXONOMY`/`UI_TAXONOMY`. Per **ADR-550 D7c** ("the contract test pins the validators, not the types"), the
load-bearing artifact is the *runtime data + a contract test*, not the TS interface (erased at the CLI/JSON
boundary). `null` taxonomy/relevance model prohibition's open-vocabulary recall first-class.

### 2. Static registry — a list, not a loader

`src/probe-registry.cts` exports `PROBE_REGISTRY = [EDGE, PROHIBITION, UI]` — the code form of the `CONTEXT.md:416`
predicate. It is a **hand-maintained static list**, never a plugin auto-loader / IoC discovery (Gall's Law: the
descriptor is the cheap-to-grow seam; inversion-of-control is not earned).

### 3. Generated manifest, drift-pinned

`scripts/gen-probe-manifest.cjs` renders the registry to `docs/reference/probe-manifest.md`, added to the existing
`lint:generated-sync --check` chain (sibling of `gen-adr-index`, `gen-registry`, …) — killing the source↔prose
drift. Every entry is worded **"questions this probe can raise,"** never "coverage"/"considerations caught"
(Goodhart: the classifier is a signal; the human/LLM confirm step is what makes coverage sound).

### 4. `probe {list, describe, run}` as a Layer-2 host-router cluster (ADR-2346)

Introspection + unified invocation ship as a host-router cluster (`dispatchHostCommand` / `HOST_COMMAND_ROUTERS`
via `routeHubCommandFamily`, shared `--flag value` parser), with a cutover-equivalence test extending
`tests/audit-command-cutover.test.cjs` — **not** a capability (ADR-857/550 D6), **not** a `runCommand` switch arm
(ADR-2346 dissolves the switch). Per **Hyrum**, the *generated doc* ships first; the machine-readable `describe`
JSON is committed as a contract only when a real consumer needs it.

### 5. Determinize the floors, signals, and plumbing — keep the LLM for judgment

Codify what is mechanical (the `--auto` never-dismiss floor `autoResolve`; propose/classify; the coverage rollup;
invocation), and leave to the LLM what is judgment (the covered-vs-backstop upgrade; prohibition adversarial recall,
ADR-550 D7b; dismissal reasoning). This is the same signal-vs-judgment line the probes already encode.

### 6. The adapter factory is deferred (Gall's Law) — REJECTED for now

A `makeShapeRootedAdapter` factory collapsing the ~90%-identical edge/ui skeleton is **not built**. Two independent
reasons: (a) three working adapters is not evidence they should collapse into a framework (the "grand facility
premature" ruling); (b) the two real new-axis candidates (STRIDE threat, eval failure-mode) are *also*
non-shape-rooted, so a shape-rooted factory would generalize over the minority shape. The descriptor delivers the
cheap-to-grow benefit without it. Adapter #4 comes from **promoting a shadow** (STRIDE first), and *that* is when a
shared floor-invariant is earned — not now.

### 7. Naming — `ProbeDescriptor` ≠ Runtime Capability Descriptor (ADR-1016)

"Descriptor" is already a closed-vocabulary declarative value in the ADR-857/1239 capability system (ADR-1016).
`ProbeDescriptor` is a distinct concept, documented as such, and must never be declared in or registered as a
`capabilities/` descriptor (Hyrum/Conway hygiene).

## Phases

| # | Child | Decision(s) |
|---|---|---|
| 1 | Edge `autoResolve` never-dismiss floor (built, fork PR #22) | D5 |
| 2 | `ProbeDescriptor` + per-adapter descriptors + static registry | D1, D2, D7 |
| 3 | Generated manifest + `lint:generated-sync` hook | D3 |
| 4 | `probe list/describe` introspection | D4 |
| 5 | Edge propose-then-confirm view backport | D5 |
| 6 | Deterministic `--auto` wiring + `probe run` | D4, D5 |

Governance: an approved epic does not approve its children — each is its own issue + `approved-enhancement` before
code (upstream).

## Acceptance criteria (must-haves)

- Descriptor is runtime data + a contract test pinning descriptor↔source parity (D1, ADR-550 D7c); JSON-serializable;
  prohibition modeled with `taxonomy:null` (not forced into a category shape).
- Registry is a static list; no auto-discovery (D2).
- Manifest regenerates deterministically and `--check` fails on drift; wording = "questions each probe can raise" (D3).
- `probe` command passes a cutover-equivalence test; no `runCommand` switch arm added (D4).
- No adapter factory introduced (D6). `ProbeDescriptor` never appears in `capabilities/` (D7).

## Consequences

- **Positive:** probes become introspectable and drift-proof; the never-dismiss floor is code-enforced for edge
  (reference impl the shadows can later import); a new axis fills a descriptor, not a duplicated skeleton + resolver
  + prose doc; the `CONTEXT.md:416` predicate gains a code home (Conway: the family finally has an owning object).
- **Negative / accepted:** one more generated artifact to keep in sync (mitigated by reusing the generated-sync
  seam); `probe describe` JSON becomes a contract once shipped (mitigated by doc-first sequencing, D4); the shadow-probe
  duplication is *documented but not resolved* (deliberately deferred, D6).

## References

- [ADR-550](550-spec-phase-probe-contract.md) — spec-phase probe contract (D6/D7b/D7c/D7e). Refined here.
- [ADR-857](857-capability-system.md) §147 — verification-substrate boundary (probes are core, not a Capability).
- [ADR-2346](2346-command-dispatch-completion.md) — Layer-2 host-router clusters (`probe` command shape, D4).
- [ADR-1016](1016-runtime-capability-descriptor.md) — Runtime Capability Descriptor (name-collision disambiguation, D7).
- [ADR-1606](1606-prohibition-enforcement-verify-seam.md) — prohibition-enforcement verify-time seam (bimodal correction).
- [ADR-457](457-generated-cjs-single-source.md) / [ADR-3524](3524-cjs-sdk-hard-seam.md) — author in `src/*.cts`, `build:lib` emits `bin/lib/*.cjs`; CJS↔SDK hand-sync seam.
