'use strict';

/**
 * Regression for #48: acquireLock must RETRY within the waitForFresh budget when a steal-rename loses
 * the race, not return null on the FIRST lost race.
 *
 * When two acquirers concurrently steal the same stale lock, only one rename can move the inode; the
 * loser's source is already gone, so retryRenameSync throws ENOENT (which it does not retry). The old
 * code hit `catch { return null }` and failed immediately — violating the waitForFresh contract ("null
 * only once the budget is exhausted") and spuriously failing a contended consent write during
 * crash-recovery. The fix backs off and retries within the bounded budget on an ENOENT lost race,
 * exactly like the sameLockInstance recheck-mismatch path already does.
 *
 * Deterministic via the module's own _setLockProbes seam (the same convention the #1462 liveness tests
 * use): inject a `renameSteal` that throws ENOENT on the first call, then delegates to the real rename —
 * no real competing process needed. Fails RED against the pre-fix twin (handle === null).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { cleanup } = require('./helpers.cjs');

const lock = require('../gsd-core/bin/lib/capability-lock.cjs');

/** Seed a steal-eligible stale lock: a dead-pid body backdated well past LOCK_STALE_MS (60s). */
function seedStaleLock(lockPath) {
  const staleTs = Date.now() - 5 * 60 * 1000;
  fs.writeFileSync(
    lockPath,
    JSON.stringify({ token: 'old-1', pid: 999999, hostname: os.hostname(), startTime: 'OLDSTART', ts: staleTs }),
    'utf8',
  );
  const old = new Date(staleTs);
  fs.utimesSync(lockPath, old, old);
}

test('acquireLock retries within budget when a steal-rename loses the race (ENOENT), not immediate null (#48)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lock-48-'));
  t.after(() => cleanup(dir));
  const lockPath = path.join(dir, '.lock');
  seedStaleLock(lockPath);

  let renameCalls = 0;
  lock._setLockProbes({
    isPidAlive: () => false, // dead holder → steal-eligible
    getProcessStartTime: () => 'OLDSTART',
    renameSteal: (from, to) => {
      renameCalls += 1;
      if (renameCalls === 1) {
        // First steal LOSES the race: our source was already renamed away by a competitor.
        const e = new Error('ENOENT: another process won the steal');
        e.code = 'ENOENT';
        throw e;
      }
      fs.renameSync(from, to); // subsequent attempt: the real rename succeeds and the lock is stolen.
    },
  });
  t.after(() => lock._resetLockProbes());

  const handle = lock.acquireLock(lockPath, { waitForFresh: true, maxAttempts: 5 });

  assert.ok(handle, 'acquireLock must retry after a lost steal-race (ENOENT) and win, not return null on the first race');
  assert.ok(renameCalls >= 2, `the steal must be retried within the budget (>=2 rename attempts), got ${renameCalls}`);
  lock.releaseLock(handle);
});

test('acquireLock still returns null when the steal-rename fails with a NON-race errno (#48)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lock-48b-'));
  t.after(() => cleanup(dir));
  const lockPath = path.join(dir, '.lock');
  seedStaleLock(lockPath);

  lock._setLockProbes({
    isPidAlive: () => false,
    getProcessStartTime: () => 'OLDSTART',
    renameSteal: () => {
      // A genuine rename failure (not the lost-race signature) must NOT be retried — unchanged behavior.
      const e = new Error('EPERM: operation not permitted');
      e.code = 'EPERM';
      throw e;
    },
  });
  t.after(() => lock._resetLockProbes());

  const handle = lock.acquireLock(lockPath, { waitForFresh: true, maxAttempts: 5 });
  assert.strictEqual(handle, null, 'a non-race rename failure (EPERM) returns null immediately, as before');
});
