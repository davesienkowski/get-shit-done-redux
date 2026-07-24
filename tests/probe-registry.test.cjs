/**
 * probe-registry unit tests — the static self-description registry for the probe family
 * (epic probe self-description, child 2).
 *
 * Asserts the LOCKED shape of `ProbeDescriptor` + the registry against the BUILT artifacts
 * (`gsd-core/bin/lib/probe-registry.cjs` and the three adapter/core modules it composes),
 * which `npm run build:lib` (pretest) emits from `src/*.cts`.
 *
 * The registry is a STATIC list (Gall-safe — the code form of the CONTEXT.md:416 predicate),
 * NOT a plugin auto-loader. Each adapter exports a descriptor referencing its EXISTING constants;
 * these tests pin descriptor↔source parity so the registry can never silently drift from the
 * live taxonomies (the anti-drift value the generated manifest, child 3, renders from).
 * Structured-value assertions only (no source-grep).
 */
'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const LIB = path.join(__dirname, '..', 'gsd-core', 'bin', 'lib');
const reg = require(path.join(LIB, 'probe-registry.cjs'));
const ep = require(path.join(LIB, 'edge-probe.cjs'));
const uc = require(path.join(LIB, 'ui-consideration-probe.cjs'));
const core = require(path.join(LIB, 'probe-core.cjs'));

describe('probe-registry: PROBE_REGISTRY shape', () => {
  test('enumerates exactly the three axes edge, prohibition, ui (the CONTEXT.md:416 family)', () => {
    assert.deepEqual(reg.PROBE_REGISTRY.map((d) => d.axis), ['edge', 'prohibition', 'ui']);
  });
  test('every descriptor carries the locked ProbeDescriptor fields', () => {
    for (const d of reg.PROBE_REGISTRY) {
      assert.equal(typeof d.axis, 'string');
      assert.equal(typeof d.title, 'string');
      assert.equal(typeof d.invoke, 'string');
      assert.ok(d.proposeKind === 'deterministic' || d.proposeKind === 'llm-recall');
      assert.ok(Array.isArray(d.verificationTiers) && d.verificationTiers.length >= 1);
      // taxonomy is either null (open-vocab) or an array of {id,name,applicableTo[],question}
      assert.ok(d.taxonomy === null || Array.isArray(d.taxonomy));
      assert.ok(d.relevance === null || (typeof d.relevance.name === 'string' && Array.isArray(d.relevance.vocabulary)));
    }
  });
  test('the whole registry is JSON-serializable (no RegExp/fn leaked) — required for `probe describe` + the manifest', () => {
    const round = JSON.parse(JSON.stringify(reg.PROBE_REGISTRY));
    assert.deepEqual(round.map((d) => d.axis), ['edge', 'prohibition', 'ui']);
  });
});

describe('probe-registry: getProbeDescriptor', () => {
  test('returns the descriptor for a known axis', () => {
    assert.equal(reg.getProbeDescriptor('edge').axis, 'edge');
    assert.equal(reg.getProbeDescriptor('prohibition').proposeKind, 'llm-recall');
  });
  test('returns undefined for an unknown axis', () => {
    assert.equal(reg.getProbeDescriptor('nope'), undefined);
  });
});

describe('probe-registry: descriptor↔source parity (anti-drift)', () => {
  test('edge descriptor mirrors the live TAXONOMY (ids, names, applicableTo=shapes, question=probe) + tiers', () => {
    const edge = reg.getProbeDescriptor('edge');
    assert.equal(edge.proposeKind, 'deterministic');
    assert.deepEqual(edge.verificationTiers, ['explicit', 'backstop']);
    assert.deepEqual(edge.taxonomy.map((t) => t.id), ep.TAXONOMY.map((c) => c.id));
    for (const t of edge.taxonomy) {
      const src = ep.TAXONOMY.find((c) => c.id === t.id);
      assert.equal(t.name, src.name);
      assert.deepEqual(t.applicableTo, src.shapes);
      assert.equal(t.question, src.probe);
    }
    assert.deepEqual([...edge.relevance.vocabulary].sort(), [...ep.VALID_SHAPES].sort());
  });
  test('ui descriptor mirrors the live UI_TAXONOMY (applicableTo=elements, question=consideration) + tiers', () => {
    const ui = reg.getProbeDescriptor('ui');
    assert.equal(ui.proposeKind, 'deterministic');
    assert.deepEqual(ui.verificationTiers, ['explicit', 'backstop']);
    assert.deepEqual(ui.taxonomy.map((t) => t.id), uc.UI_TAXONOMY.map((c) => c.id));
    for (const t of ui.taxonomy) {
      const src = uc.UI_TAXONOMY.find((c) => c.id === t.id);
      assert.equal(t.name, src.name);
      assert.deepEqual(t.applicableTo, src.elements);
      assert.equal(t.question, src.consideration);
    }
    assert.deepEqual([...ui.relevance.vocabulary].sort(), [...uc.VALID_ELEMENT_KINDS].sort());
  });
  test('prohibition descriptor is open-vocabulary: taxonomy null, relevance null, tiers=test|judgment (ADR-550 D7b)', () => {
    const p = reg.getProbeDescriptor('prohibition');
    assert.equal(p.taxonomy, null);
    assert.equal(p.relevance, null);
    assert.equal(p.proposeKind, 'llm-recall');
    assert.deepEqual(p.verificationTiers, core.PROHIBITION_VALIDATORS.verification);
    assert.deepEqual(p.verificationTiers, ['test', 'judgment']);
  });
});
