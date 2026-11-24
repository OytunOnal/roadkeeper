// @level domain
// Roadkeeper — a slice's planned structure: the spec's `## Structure` section read into modules, edges and seams, and
// compared with what was built — structure.json at the base against structure.json at the head, by module pairs. Pure:
// text and models in, data out; the plan command's lines are plan-lines.mjs, the drawing is slice-plan-drawing.mjs, the
// files are read by plan-files.mjs.
//
// The contract is the drawing, not the rendered spec: the human approves what `draw` printed from this reading, and
// `check` compares the build with the same reading, so a renderer showing other text changes nothing approved.
// Reads one `## Structure` section, strict: plan lines only. Refuses, as unread, any other line in it, a fence in it or
// never closed, and an HTML block a renderer hides, anywhere. An unread line makes the check and the drawing exit 1.

import { fenceStep } from "../../../_text.mjs";
import { pathAndParents } from "../../lib/path-match.mjs";
import { ARROW, LEVEL_NAME } from "../../lib/dependency-rules.mjs";
import { EDGE_KINDS, pairsOf, partLevels, placed } from "../../lib/structure-model.mjs";
import { structurePath } from "../../lib/structure-path.mjs";

// a slice plans a handful of modules and edges: past this many plan lines the rest are unread, and said
const MAX_PLAN = 200;
// a spec is a page or two of prose: a megabyte is far past one
export const SPEC_CAP = 1024 * 1024;
// the three plan lines, anchored on fixed words and backticks so a long line costs its length; a level is a name as
// dependency-rules.md's levels are, a module line names the levels the slice adds to the module or touches in it
// (`@application @infrastructure`), and an edge's kind is one structure.json knows
const LEVEL = LEVEL_NAME.source.slice(1, -1);
// - module `path` @level … — what it holds
const MODULE_LINE = new RegExp(String.raw`^-\s+module\s+\x60([^\x60]+)\x60\s+(@${LEVEL}(?:\s+@${LEVEL})*)(?:\s+[—–-]\s+.*)?$`);
// - edge `from` → `to` — kind
const EDGE_LINE = new RegExp(String.raw`^-\s+edge\s+\x60([^\x60]+)\x60${ARROW}\x60([^\x60]+)\x60\s+[—–-]\s+(${EDGE_KINDS.join("|")})(?:\b.*)?$`);
// - seam `module` — production: …; test: …
const SEAM_LINE = /^-\s+seam\s+`([^`]+)`\s+[—–-]\s+.+$/;
// the section's heading (`## Structure`, a closing `#` run allowed), a heading that ends it (the next `#` or `##`, a
// space or tab after its marks), and a line that may be a plan line (`- module`, `- edge` or `- seam`): each at most
// three spaces in, outside a fence, as a renderer reads a heading or a list item; a tab or any other space before it
// makes it something else. Any other non-blank line in the section (prose, a comment, an indented or fenced block, a
// deeper heading, a `*` item) is unread.
const SECTION = /^##[ \t]+structure(?:[ \t]+#+)?[ \t]*$/i;
const ENDS = /^ {0,3}#{1,2}(?:[ \t]|$)/; // a heading that ends the section
const ITEM = /^ {0,3}-\s/; // a line that may be a plan line
// what an unread line in the section is told
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
    const fencedOrBlank = step.isFence || fence || !line;
    if (fencedOrBlank) return;
    if (HIDDEN.test(raw)) return malformed.push({ where: at, what: "an HTML block a renderer hides: the plan is read from plain Markdown only" });
    if (ENDS.test(raw)) { inside = SECTION.test(line); found = found || inside; return; }
    if (!inside) return;
    if (!ITEM.test(raw)) return malformed.push({ where: at, what: NOT_PLAN });
    // past the cap a line is counted, not said: one line for all of them
    if (count++ >= MAX_PLAN) { past++; return; }
    const read = planLine(line, i + 1);
    if (read.what) malformed.push({ where: at, what: read.what });
    else if (read.module) modules.push(read.module);
    else if (read.edge) edges.push(read.edge);
    else seams.push(read.seam);
  });
  // a fence opened outside the section and never closed hides every line after it, the section among them: said at its
  // line; one opened inside was said at its line already
  if (fence && !fenceInside) malformed.unshift({ where: `spec:${fenceAt}`, what: "a fenced block opened here never closes: the lines after it are not read" });
  // first, so the cap on what is printed never folds it into a count
  if (past) malformed.unshift({ where: "spec", what: `${past} plan lines past the first ${MAX_PLAN} are not read` });
  return { modules, edges, seams, found, malformed };
}

// One plan line, at line number `n`, read: { module }, { edge } or { seam }, or { what } saying why it is unread.
function planLine(line, n) {
  let m;
  if ((m = MODULE_LINE.exec(line))) {
    const p = structurePath(m[1]);
    if (p.why) return { what: `a module's path ${p.why}` };
    return { module: { path: p.path, levels: [...new Set(m[2].split(/\s+/).map((l) => l.slice(1)))], line: n } };
  }
  if ((m = EDGE_LINE.exec(line))) {
    const f = structurePath(m[1]), t = structurePath(m[2]);
    if (f.why || t.why) return { what: `an edge's path ${f.why || t.why}` };
    return { edge: { from: f.path, to: t.path, kind: m[3], line: n } };
  }
  if ((m = SEAM_LINE.exec(line))) {
    const p = structurePath(m[1]);
    if (p.why) return { what: `a seam's module ${p.why}` };
    return { seam: { path: p.path, line: n } };
  }
  return { what: `a plan line reads - module \`path\` @level — what it holds, - edge \`from\` → \`to\` — ${EDGE_KINDS.join(" | ")}, or - seam \`module\` — production: …; test: …` };
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
