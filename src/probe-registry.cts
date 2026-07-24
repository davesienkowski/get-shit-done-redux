/**
 * probe-registry — the static self-description registry for the probe family
 * (epic: probe self-description layer + deterministic floors; ADR-20).
 *
 * A hand-maintained LIST of the three adapter descriptors — the code form of the `CONTEXT.md:416`
 * family predicate. It is deliberately NOT a plugin auto-loader / IoC discovery (Gall's Law: the
 * descriptor is the cheap-to-grow seam; inversion-of-control is not earned by three adapters). Adding
 * a fourth axis is one import + one array entry here.
 *
 * Consumed by the generated manifest (`scripts/gen-probe-manifest.cjs`) and the `probe list`/`describe`
 * introspection command. Authored as strict TypeScript and compiled by `tsc -p tsconfig.build.json` to
 * the gitignored runtime artifact `gsd-core/bin/lib/probe-registry.cjs` (ADR-457/3524); do NOT hand-edit
 * the `.cjs`.
 */

import type { ProbeDescriptor } from './probe-core.cjs';
import { PROHIBITION_DESCRIPTOR } from './probe-core.cjs';
import { EDGE_DESCRIPTOR } from './edge-probe.cjs';
import { UI_DESCRIPTOR } from './ui-consideration-probe.cjs';

/**
 * The probe family in canonical order — edge first (the original adapter), prohibition, ui (the newest).
 * A static list, never a loader.
 */
export const PROBE_REGISTRY: ProbeDescriptor[] = [EDGE_DESCRIPTOR, PROHIBITION_DESCRIPTOR, UI_DESCRIPTOR];

/** Look up a probe descriptor by its axis id; `undefined` if the axis is unknown. */
export function getProbeDescriptor(axis: string): ProbeDescriptor | undefined {
  return PROBE_REGISTRY.find((d) => d.axis === axis);
}
