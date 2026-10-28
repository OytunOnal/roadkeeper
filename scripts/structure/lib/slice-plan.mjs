// @level domain
// Roadkeeper — a slice's planned structure: the spec's `## Structure` section read into modules, edges and seams, and
// compared with what was built — structure.json at the base against structure.json at the head, by module pairs. Pure:
// text and models in, data and the plan command's lines out; the drawing is slice-plan-drawing.mjs, the files are read by
// plan-files.mjs.
//
// The contract is the drawing, not the rendered spec: the human approves what `draw` printed from this reading, and
// `check` compares the build with the same reading, so a renderer showing other text changes nothing approved.
// Reads one `## Structure` section, strict: plan lines only. Refuses, as unread, any other line in it, a fence in it or
// never closed, and an HTML block a renderer hides, anywhere. An unread line makes the check and the drawing exit 1.

import { fenceStep } from "../../_text.mjs";
import {
  ARROW, EDGE_KINDS, LEVEL_NAME, STRUCTURE_UNREAD, cutLevels, grouped, pairsOf, partLevels, pathAndParents, placed, printable, readerMessage, readsCode,
  structureModel, structurePath,
} from "./structure-model.mjs";

// a slice plans a handful of modules and edges: past this many plan lines the rest are unread, and said
const MAX_PLAN = 200;
// a spec is a page or two of prose: a megabyte is far past one
export const SPEC_CAP = 1024 * 1024;
// the three plan lines, anchored on fixed words and backticks so a long line costs its length; a level is a name as
// dependency-rules.md's levels are, a module line names the levels the slice adds to the module or touches in it
// (`@application @infrastructure`), and an edge's kind is one structure.json knows
const LEVEL = LEVEL_NAME.source.slice(1, -1);
const MODULE_LINE = new RegExp(String.raw`^-\s+module\s+\x60([^\x60]+)\x60\s+(@${LEVEL}(?:\s+@${LEVEL})*)(?:\s+[—–-]\s+.*)?$`);
const levelList = (levels) => cutLevels(levels, " ");
const EDGE_LINE = new RegExp(String.raw`^-\s+edge\s+\x60([^\x60]+)\x60${ARROW}\x60([^\x60]+)\x60\s+[—–-]\s+(${EDGE_KINDS.join("|")})(?:\b.*)?$`);
const SEAM_LINE = /^-\s+seam\s+`([^`]+)`\s+[—–-]\s+.+$/;
// the section's heading (`## Structure`, a closing `#` run allowed), a heading that ends it (the next `#` or `##`, a
// space or tab after its marks), and a line that may be a plan line (`- module`, `- edge` or `- seam`): each at most
// three spaces in, outside a fence, as a renderer reads a heading or a list item; a tab or any other space before it
// makes it something else. Any other non-blank line in the section (prose, a comment, an indented or fenced block, a
// deeper heading, a `*` item) is unread.
const SECTION = /^##[ \t]+structure(?:[ \t]+#+)?[ \t]*$/i;
const ENDS = /^ {0,3}#{1,2}(?:[ \t]|$)/;
const ITEM = /^ {0,3}-\s/;
const NOT_PLAN = "not a plan line: the section holds plan lines only — - module, - edge or - seam, at most three spaces in";
// the HTML blocks CommonMark hides or leaves unparsed: comment, processing instruction, declaration, CDATA, raw text.
// One at the start of a line outside a fence is unread wherever it stands, since it can hide the section itself.
const HIDDEN = /^ {0,3}<(?:!|\?|(?:script|style|pre|textarea)(?:[\s>]|$))/i;

// { modules: [{ path, levels, line }], edges: [{ from, to, kind, line }], seams: [{ path, line }], found, malformed }
// — `found` is whether the spec has its `## Structure` section
export function slicePlan(spec) {
  const modules = [], edges = [], seams = [], malformed = [];
  const lines = String(spec || "").replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  // the heading counted on every line, in a fence or a comment too: a second one, hidden from a renderer or from this
  // reader, would let the two read different sections
  const heads = [];
  lines.forEach((raw, i) => { if (SECTION.test(raw.trim())) heads.push(i + 1); });
  if (heads.length > 1) malformed.push({ where: `spec:${heads[1]}`, what: `## Structure is written ${heads.length} times: the plan is one section, written once` });
  let inside = false, found = false, count = 0, past = 0, fence = null, fenceAt = 0, fenceInside = false;
  lines.forEach((raw, i) => {
    const line = raw.trim(), at = `spec:${i + 1}`;
    const step = fenceStep(fence, line);
    if (step.isFence && !fence) { fenceAt = i + 1; fenceInside = inside; }
    if (step.isFence && inside) malformed.push({ where: at, what: NOT_PLAN });
    fence = step.fence;
    if (step.isFence || fence || !line) return;
    if (HIDDEN.test(raw)) return malformed.push({ where: at, what: "an HTML block a renderer hides: the plan is read from plain Markdown only" });
    if (ENDS.test(raw)) { inside = SECTION.test(line); found = found || inside; return; }
    if (!inside) return;
    if (!ITEM.test(raw)) return malformed.push({ where: at, what: NOT_PLAN });
    // past the cap a line is counted, not said: one line for all of them
    if (count++ >= MAX_PLAN) { past++; return; }
    let m;
    if ((m = MODULE_LINE.exec(line))) {
      const p = structurePath(m[1]);
      if (p.why) return malformed.push({ where: at, what: `a module's path ${p.why}` });
      modules.push({ path: p.path, levels: [...new Set(m[2].split(/\s+/).map((l) => l.slice(1)))], line: i + 1 });
    } else if ((m = EDGE_LINE.exec(line))) {
      const f = structurePath(m[1]), t = structurePath(m[2]);
      if (f.why || t.why) return malformed.push({ where: at, what: `an edge's path ${f.why || t.why}` });
      edges.push({ from: f.path, to: t.path, kind: m[3], line: i + 1 });
    } else if ((m = SEAM_LINE.exec(line))) {
      const p = structurePath(m[1]);
      if (p.why) return malformed.push({ where: at, what: `a seam's module ${p.why}` });
      seams.push({ path: p.path, line: i + 1 });
    } else {
      malformed.push({ where: at, what: `a plan line reads - module \`path\` @level — what it holds, - edge \`from\` → \`to\` — ${EDGE_KINDS.join(" | ")}, or - seam \`module\` — production: …; test: …` });
    }
  });
  // a fence opened outside the section and never closed hides every line after it, the section among them: said at its
  // line; one opened inside was said at its line already
  if (fence && !fenceInside) malformed.unshift({ where: `spec:${fenceAt}`, what: "a fenced block opened here never closes: the lines after it are not read" });
  // first, so the cap on what is printed never folds it into a count
  if (past) malformed.unshift({ where: "spec", what: `${past} plan lines past the first ${MAX_PLAN} are not read` });
  return { modules, edges, seams, found, malformed };
}

// A module line naming a level dependency-rules.md does not declare (`sm`, any model read from it): unread at its line, as the
// reader's unread lines are — the first such level quoted, the rest counted. [{ where, what }]
export function undeclaredLevels(plan, sm) {
  const out = [];
  for (const m of plan.modules) {
    const u = m.levels.filter((l) => placed(sm, l).ring === null);
    if (u.length) out.push({ where: `spec:${m.line}`, what: `the module line names a level dependency-rules.md's ## Levels does not declare: \`${u[0]}\`${u.length > 1 ? ` and ${u.length - 1} more` : ""}` });
  }
  return out;
}

// the deepest module whose path is a whole-segment prefix of `p`, among `paths`
function ownerIn(paths, p) {
  for (const q of pathAndParents(p)) if (paths.has(q)) return q;
  return null;
}

// The plan's edges as module pairs on a model (`sm`: the current structure for the drawing, the base for the check —
// the same one): a planned edge names modules, or files read as the module that holds them — in the model, or planned —
// so an edge to a module not built is not read as one to the module around it. An edge with both ends in one module is
// `inside`: no pair holds it, so it could never read as built; the drawing and the check both say it. { pairs: Map(key
// → edge), inside: [{ module, line }], resolve: path → its module }
export function planEdges(plan, sm) {
  const known = new Set([...sm.modules.map((m) => m.path), ...plan.modules.map((m) => m.path)]);
  const resolve = (p) => ownerIn(known, p) || p;
  const pairs = new Map(), inside = [];
  for (const e of plan.edges) {
    const from = resolve(e.from), to = resolve(e.to);
    if (from === to) inside.push({ module: from, line: e.line });
    else pairs.set(`${from}\n${to}`, { from, to, kind: e.kind, line: e.line });
  }
  return { pairs, inside, resolve };
}

// What was built against what was planned: `base` and `head` are structureModel outputs. Compared: modules new at the
// head, planned levels, and edges between two modules new at the head; a file no module holds stands as itself, its
// tag's levels compared alike, and a file the head does not list is not built. An edge's kind is drawn, not compared: a
// pair is one dependency whatever its kinds. Not compared: whether a seam has its adapters (review reads the seams),
// what was removed, and a new file no module holds that no line plans.
export function planDiff(plan, base, head) {
  const basePaths = new Set(base.modules.map((m) => m.path));
  const headLevels = partLevels(head), baseLevels = partLevels(base);
  const plannedModules = new Map(plan.modules.map((m) => [m.path, m]));
  // a planned file reads as its module on the base, the structure the drawing was made on, so the check compares the
  // pairs the human approved
  const { pairs: plannedPairs, inside } = planEdges(plan, base);
  const out = { unplannedModules: [], unbuiltModules: [], levels: [], unplannedEdges: [], unbuiltEdges: [], inside };
  const before = pairsOf(base), after = pairsOf(head);
  for (const m of head.modules) if (!basePaths.has(m.path) && !plannedModules.has(m.path)) out.unplannedModules.push(m.path);
  for (const m of plan.modules) {
    if (!headLevels.has(m.path)) out.unbuiltModules.push(m.path);
    else {
      // each planned level built, and every level the module or file gained planned
      const built = headLevels.get(m.path), had = new Set(baseLevels.get(m.path) || []), planned = new Set(m.levels);
      if (m.levels.some((l) => !built.includes(l)) || built.some((l) => !had.has(l) && !planned.has(l))) out.levels.push({ path: m.path, planned: m.levels, built });
    }
  }
  // an edge from outside every module is compared only when planned
  const unplanned = (key, e) => e.modules && !before.has(key) && !plannedPairs.has(key);
  for (const [key, e] of after) if (unplanned(key, e)) out.unplannedEdges.push(e);
  for (const [key, e] of plannedPairs) if (!after.has(key)) out.unbuiltEdges.push(e);
  return out;
}

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

// What was built against the plan, from the files read and `noBase`, whether the slice adds structure.json:
// { lines, failed } — failed on any line but a seam's.
export function planCheckLines(files, noBase) {
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
