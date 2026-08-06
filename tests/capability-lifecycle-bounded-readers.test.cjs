'use strict';

/**
 * Regression for #50: readManifest / readJsonFile must read a capability.json / shared-settings file
 * through the bounded fd-based reader (open O_NONBLOCK → fstat → require regular → size cap), so a
 * repo-plantable non-regular or oversized file is REFUSED (null) rather than hanging (FIFO, no writer)
 * or reading unbounded (OOM) under the held mutation lock. Mirrors the existing "a FIFO lock body does
 * NOT hang acquireLock" precedent (finding 2, #1459) in this subsystem's sibling suite.
 *
 * The oversized case is a clean deterministic RED→GREEN (pre-fix: raw readFileSync reads the whole file
 * and returns a non-null object; post-fix: refused by the size cap → null). The FIFO cases pin the
 * no-hang behavior (pre-fix they BLOCK forever; verified separately under an OS timeout).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { cleanup } = require('./helpers.cjs');

const lifecycle = require('../gsd-core/bin/lib/capability-lifecycle.cjs');

/** Create a FIFO at p; return false (skip) on a platform without mkfifo (e.g. Windows). */
function tryMkfifo(p) {
  try {
    execFileSync('mkfifo', [p]);
    return true;
  } catch {
    return false;
  }
}

test('readManifest does NOT hang on a FIFO capability.json — bounded read returns null (#50)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-c01-'));
  t.after(() => cleanup(dir));
  const manifest = path.join(dir, 'capability.json');
  if (!tryMkfifo(manifest)) {
    t.skip('mkfifo unavailable on this platform');
    return;
  }
  let result;
  assert.doesNotThrow(() => {
    result = lifecycle.readManifest(dir);
  }, 'readManifest must not hang/throw on a FIFO capability.json');
  assert.strictEqual(result, null, 'a FIFO (non-regular) manifest is refused → null, not a hang');
});

test('readJsonFile does NOT hang on a FIFO file — bounded read returns null (#50)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-c01b-'));
  t.after(() => cleanup(dir));
  const poison = path.join(dir, 'poison.json');
  if (!tryMkfifo(poison)) {
    t.skip('mkfifo unavailable on this platform');
    return;
  }
  let result;
  assert.doesNotThrow(() => {
    result = lifecycle.readJsonFile(poison);
  }, 'readJsonFile must not hang/throw on a FIFO file');
  assert.strictEqual(result, null, 'a FIFO file is refused → null, not a hang');
});

test('readManifest refuses an oversized capability.json via the size cap (#50)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-c01c-'));
  t.after(() => cleanup(dir));
  // A VALID-JSON manifest just over the 8 MiB cap: pre-fix the raw readFileSync reads it whole and
  // returns a non-null object; post-fix the bounded reader refuses it (EFBIG → caught → null).
  const oversized = `{"id":"x","pad":"${'A'.repeat(8 * 1024 * 1024 + 16)}"}`;
  fs.writeFileSync(path.join(dir, 'capability.json'), oversized, 'utf8');
  assert.strictEqual(lifecycle.readManifest(dir), null, 'an oversized manifest is refused by the size cap, not read whole');
});
