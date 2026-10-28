// @level presentation
// Roadkeeper — a slice's plan drawn as mermaid for the spec's approval: the modules it touches and their neighbours grey,
// the change in colour; a file no module holds is a box of its own, at its levels. Pure: a plan and a model in,
// mermaid text out; the plan's reading and edges are slice-plan.mjs.

import { cutLevels, grouped, pairsOf, partLevels, placed, printable } from "./structure-model.mjs";
import { insideLine, planEdges, planRead } from "./slice-plan.mjs";

// the drawing: the planned modules first, then their neighbours, at most this many boxes, the rest counted
const MAX_DRAWN = 40;

// The plan drawn on the current structure (`sm`, the model the spec is written against): one box per module, grouped by
// level outermost on top; what exists grey, what the plan adds or moves to another level in colour, a seam marked.
// Mermaid text, every name printed through `printable`, so the repository's text cannot write mermaid.
export function slicePlanDrawing(plan, sm) {
  const level = partLevels(sm);
  const known = new Set(level.keys());
  const fresh = new Set(plan.modules.filter((m) => !known.has(m.path)).map((m) => m.path));
  // a planned module is drawn at its planned levels, coloured when they are not the levels it has, as the check reads it
  const same = (a, b) => a.length === b.length && a.every((l) => b.includes(l));
  const moved = new Set(plan.modules.filter((m) => known.has(m.path) && !same(level.get(m.path), m.levels)).map((m) => m.path));
  for (const m of plan.modules) level.set(m.path, m.levels);
  const { pairs: planned, resolve } = planEdges(plan, sm);
  const existing = pairsOf(sm);
  // the boxes: what the plan names first, then the modules one existing edge away from them
  const order = [], seen = new Set();
  const add = (p) => { if (!seen.has(p)) { seen.add(p); order.push(p); } };
  for (const m of plan.modules) add(m.path);
  for (const e of planned.values()) { add(e.from); add(e.to); }
  for (const s of plan.seams) add(resolve(s.path));
  const named = new Set(order);
  for (const e of existing.values()) { if (named.has(e.from)) add(e.to); if (named.has(e.to)) add(e.from); }
  const drawn = order.slice(0, MAX_DRAWN), left = order.length - drawn.length, inView = new Set(drawn);
  const id = new Map(drawn.map((p, i) => [p, `n${i}`]));
  const seams = new Set(plan.seams.map((s) => resolve(s.path)));
  const lines = ["flowchart TB"];
  // one group per set of levels, innermost first in its name, ranked by its outermost ring, outermost on top, as the
  // Architecture tab draws them; a module with no declared level last
  const ring = (l) => placed(sm, l).ring ?? -1;
  const groups = new Map();
  for (const p of drawn) {
    const ls = [...(level.get(p) || [])].sort((a, b) => ring(a) - ring(b)), key = ls.join("\n");
    if (!groups.has(key)) groups.set(key, { ls, paths: [] });
    groups.get(key).paths.push(p);
  }
  const rank = (ls) => Math.max(-1, ...ls.map(ring));
  [...groups.values()].sort((a, b) => rank(b.ls) - rank(a.ls)).forEach(({ ls, paths }, g) => {
    lines.push(`  subgraph L${g}["${ls.length ? cutLevels(ls, " + ") : "no level"}"]`);
    for (const p of paths) lines.push(`    ${id.get(p)}["${printable(p)}${seams.has(p) ? " ◇ seam" : ""}"]`);
    lines.push("  end");
  });
  const links = [], colour = [];
  let unseen = 0;
  // a planned edge that already exists is drawn as existing: the plan changes nothing there
  for (const e of existing.values()) if (inView.has(e.from) && inView.has(e.to)) links.push(`  ${id.get(e.from)} --> ${id.get(e.to)}`);
  for (const [key, e] of planned) {
    if (existing.has(key)) continue;
    if (!inView.has(e.from) || !inView.has(e.to)) { unseen++; continue; }
    colour.push(links.length);
    links.push(`  ${id.get(e.from)} ==>|${e.kind}| ${id.get(e.to)}`);
  }
  lines.push(...links);
  lines.push("  classDef current fill:#f3f4f6,stroke:#9ca3af,color:#4b5563");
  lines.push("  classDef planned fill:#dbeafe,stroke:#2563eb,color:#1e3a8a");
  if (drawn.length) lines.push(`  class ${drawn.map((p) => id.get(p)).join(",")} current`);
  const freshDrawn = drawn.filter((p) => fresh.has(p) || moved.has(p));
  if (freshDrawn.length) lines.push(`  class ${freshDrawn.map((p) => id.get(p)).join(",")} planned`);
  if (links.length) lines.push("  linkStyle default stroke:#9ca3af");
  if (colour.length) lines.push(`  linkStyle ${colour.join(",")} stroke:#2563eb,stroke-width:2px`);
  // what the drawing leaves out is a box in it, not a comment the rendered page hides; an edge goes unseen only when
  // one of its ends is past the boxes, so the box is there whenever one does
  if (left > 0) {
    lines.push(`  more["${left} more modules and ${unseen} planned edges not drawn: at most ${MAX_DRAWN} boxes"]`);
    lines.push("  classDef cut fill:#fef3c7,stroke:#d97706,color:#78350f");
    lines.push("  class more cut");
  }
  return lines.join("\n");
}

// The plan command's draw, from the files read (plan-files.mjs, planFiles): { lines, failed }, the drawing in a mermaid
// fence after what was unread, as mermaid comments; failed when a line was unread, so a broken plan is not approved as
// drawn. A drawing on a structure that does not read would show the unread part as absent: said first, drawn anyway.
export function planDrawLines(files) {
  const r = planRead(files);
  if (r.stop) return { lines: r.stop, failed: true };
  const { plan, head, unread } = r;
  if (head.malformed.length) unread.push(`unread    ${head.malformed.length} lines of the structure files not read: structure-check.mjs names them`);
  for (const x of planEdges(plan, head).inside) unread.push(insideLine(x));
  return { lines: [...grouped(unread).map((l) => `%% ${l}`), "```mermaid", slicePlanDrawing(plan, head), "```"], failed: unread.length > 0 };
}
