---
type: Fixed
pr: 40
---
**`GSD_AUDIT=1` now actually produces the dispatch audit trail.** The Command Routing Hub's reference `DispatchLogger` is now injected on the live CLI dispatch path (it was never wired, so `GSD_AUDIT` / `config.audit.enabled` were inert and error dispatches were silently swallowed — the ADR-0174 §6 seam never ran). With observability enabled, a dispatch now appends a `DispatchEvent` line to `.planning/.gsd-trace.jsonl`; with it off, behavior is unchanged. (#26)
