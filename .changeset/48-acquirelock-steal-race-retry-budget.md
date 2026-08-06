---
type: Fixed
pr: 49
---

**A contended consent write no longer spuriously fails when a lock steal-race is lost during crash-recovery.** In `acquireLock`'s bounded steal loop, when two acquirers concurrently steal the same stale lock only one rename can move the inode; the loser's rename source is already gone, so `retryRenameSync` throws `ENOENT` (which it does not retry), and the old `catch { return null }` returned immediately — regardless of `waitForFresh` and the remaining attempt budget. That violated the `waitForFresh` contract ("two racing consent writers serialize; null only when contention outlasts the budget") and left a successfully-installed capability inactive because its consent write lost a race the winner held for only a sub-millisecond critical section. The lost steal-rename now backs off and retries within the budget on `ENOENT` — exactly like the `sameLockInstance` recheck-mismatch path — and returns `null` only on a non-race rename failure or once the budget is exhausted. (#48)
