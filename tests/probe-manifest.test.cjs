/**
 * probe-manifest generator unit tests (epic #20, child 3).
 *
 * Asserts `renderManifest(registry)` renders the live `PROBE_REGISTRY` (built artifact) into the
 * expected manifest shape. The committed `docs/reference/probe-manifest.md` parity is enforced by
 * `scripts/gen-probe-manifest.cjs --check` in `lint:generated-sync`; this pins the RENDER itself.
 * Structured-value assertions on the returned string (no source-grep of shipped files).
 */
'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { renderManifest } = require('../scripts/gen-probe-manifest.cjs');
const { PROBE_REGISTRY } = require(path.join(__dirname, '..', 'gsd-core', 'bin', 'lib', 'probe-registry.cjs'));

describe('gen-probe-manifest: renderManifest', () => {
  const md = renderManifest(PROBE_REGISTRY);

  test('renders a section for every axis in the registry', () => {
    for (const d of PROBE_REGISTRY) {
      assert.ok(md.includes(`## \`${d.axis}\``), `manifest must have a section for axis ${d.axis}`);
    }
  });
  test('Goodhart wording: enumerates "question this probe can raise", never "coverage"', () => {
    assert.ok(md.includes('Question this probe can raise'));
    assert.ok(/question this probe can raise/i.test(md));
    assert.ok(!/considerations caught|guarantees coverage/i.test(md));
  });
  test('an open-vocabulary probe (prohibition) renders the no-closed-taxonomy note, not a category table', () => {
    const prohibition = PROBE_REGISTRY.find((d) => d.taxonomy === null);
    assert.ok(prohibition, 'fixture expects at least one open-vocabulary probe');
    assert.ok(md.includes('Open-vocabulary probe — no closed category taxonomy'));
  });
  test('a closed-taxonomy probe renders every one of its taxonomy questions verbatim', () => {
    const edge = PROBE_REGISTRY.find((d) => d.axis === 'edge');
    for (const t of edge.taxonomy) {
      assert.ok(md.includes(t.question), `manifest must render the edge "${t.id}" question`);
    }
  });
  test('is deterministic — two renders of the same registry are byte-identical', () => {
    assert.equal(renderManifest(PROBE_REGISTRY), renderManifest(PROBE_REGISTRY));
  });
});
