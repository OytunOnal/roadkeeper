// @level presentation
// Roadkeeper — the plan command's lines: the plan read from the files, what was unread, and what was built against it,
// in the check's words. Pure: the files read (plan-files.mjs) in, lines out; the plan's reading and comparison are
// slice-plan.mjs's.

import { printable, readerMessage } from "../../lib/printable.mjs";
import { cutLevels, grouped } from "../../lib/cut-lines.mjs";
import { readsCode, structureModel } from "../../lib/structure-model.mjs";
import { STRUCTURE_UNREAD } from "../../lib/report-lines.mjs";
import { SPEC_CAP, planDiff, slicePlan, undeclaredLevels } from "./slice-plan.mjs";

const levelList = (levels) => cutLevels(levels, " ");

// an edge planned inside one module, said alike by draw and check
export const insideLine = (x) => `unread    spec:${x.line} — both ends are in module ${printable(x.module)}: an edge inside one module is not compared`;

// The plan and the head's model, from the files read (plan-files.mjs, planFiles): { plan, head, unread, the lines unread
// so far } — or { stop }, the lines to print when nothing can be compared. What the reader could not read is said before
// the missing section, so a fence never closed above it is named at its line, not as a missing section.
export function planRead({ spec, md, js }) {
  const unread = [];
  if (!spec) unread.push(`unread    the spec is missing, empty, a link, or over ${SPEC_CAP / 1024 / 1024} MB`);
  if (!md || !js) unread.push(STRUCTURE_UNREAD);
  if (unread.length) return { stop: [...unread, "plan: unread"] };
  const plan = slicePlan(spec);
  if (!plan.found) return { stop: [...grouped(plan.malformed.map((m) => `unread    ${m.where} — ${readerMessage(m.what)}`)), "unread    the spec has no ## Structure section", "plan: unread"] };
  const head = structureModel(md, js);
  // a level the plan names and dependency-rules.md does not declare, at its line after the reader's own
  for (const m of [...plan.malformed, ...undeclaredLevels(plan, head)]) unread.push(`unread    ${m.where} — ${readerMessage(m.what)}`);
  return { plan, head, unread };
}

// What was built against the plan, from the files read; `noBase` when the slice adds structure.json: { lines, failed }
// — failed on any line but a seam's.
export function planCheckLines(files, { noBase }) {
  const r = planRead(files);
  if (r.stop) return { lines: r.stop, failed: true };
  const { plan, head, unread } = r;
  let base = { modules: [], loose: [], edges: [] };
  if (!noBase) {
    if (!files.base) return { lines: [...unread, "unread    the base structure.json is missing, empty, a link, or over the cap", "plan: unread"], failed: true };
    base = structureModel(files.md, files.base);
    const lost = base.malformed.filter((m) => m.where.startsWith("structure.json")).length;
    if (lost) unread.push(`unread    ${lost} lines of the base structure.json not read: what they held may read as built`);
    if (!readsCode(base)) unread.push("unread    the base structure.json lists no modules and no files: pass --no-base if the slice adds structure.json");
  }
  const lostHead = head.malformed.filter((m) => m.where.startsWith("structure.json")).length;
  if (lostHead) unread.push(`unread    ${lostHead} lines of structure.json not read: structure-check.mjs names them`);
  if (!readsCode(head)) unread.push("unread    structure.json lists no modules and no files: rerun the structure command");
  const d = planDiff(plan, base, head);
  for (const x of d.inside) unread.push(insideLine(x));
  // each group at most GROUP lines and the rest counted, as structure-check prints
  const groups = [
    unread,
    d.unplannedModules.map((p) => `unplanned module ${printable(p)} — built, not in the plan`),
    d.unplannedEdges.map((e) => `unplanned edge   ${printable(e.from)} → ${printable(e.to)} — built, not in the plan`),
    d.unbuiltModules.map((p) => `unbuilt   module ${printable(p)} — planned, not built`),
    d.unbuiltEdges.map((e) => `unbuilt   edge   ${printable(e.from)} → ${printable(e.to)} — planned (spec:${e.line}), not built`),
    d.levels.map((l) => `level     module ${printable(l.path)} — planned at ${levelList(l.planned)}, built at ${l.built.length ? levelList(l.built) : "no level"}`),
  ];
  const differs = groups.some((g) => g.length > 0);
  const out = [...groups.flatMap((g) => grouped(g)), ...grouped(plan.seams.map((s) => `seam      ${printable(s.path)} — read by the Spec axis (spec:${s.line})`))];
  out.push(differs ? "plan: differs" : "plan: as built");
  return { lines: out, failed: differs };
}
