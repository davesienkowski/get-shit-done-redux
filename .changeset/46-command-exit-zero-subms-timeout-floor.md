---
type: Fixed
pr: 47
---

**A positive sub-millisecond `command-exit-zero` gate timeout no longer disables the execution bound.** `evaluateCommandExitZero` converted `predicate.timeout` seconds to milliseconds with `Math.floor(rawTimeout * 1000)`, so any declared `0 < timeout < 0.001` (e.g. `0.0004`) floored to `0`. That `0` reached the bounded-shell seam, whose `?? 30_000` default does not re-default `0`, and `spawnSync({ timeout: 0 })` treats `0` as **no** timeout — so a gate that declared a tight bound ran unbounded, the "unbounded gate could hang the loop forever" failure ADR-2008 says the timeout exists to prevent. The conversion is now clamped to a ≥1ms floor (`Math.max(1, Math.floor(rawTimeout * 1000))`); whole-second conversions, the 30s default, and the throw-on-non-positive/non-finite validation are unchanged. (#46)
