// @level presentation
// Roadkeeper — the Architecture tab's entry, its one interface (architectureTab); everything under lib/ is private. The tab
// draws the structure: the declared levels as bands, modules as UML-style cards showing their
// interface (the exported names of each one's entry), dependency chips and violation arrows, and a double-click that
// opens a module into its nested modules and files.
//
// Pure: it takes the structure report, or the view's data (tabData, lib/tab-data.mjs), and returns the HTML, the
// style and the page's script, embedding every function of the client's one entry (tabDrawing, lib/tab-drawing.mjs), its
// parts (lib/tab-counts.mjs, lib/tab-words.mjs, lib/tab-panel.mjs, lib/tab-layout.mjs and lib/tab-routes.mjs) and the client (lib/tab-dom.mjs) by its own
// source. Every string in the model is the repository's text: the HTML escapes it, and the client
// receives it as JSON and writes it with textContent and setAttribute only.

import { functionSources } from "../../_function-sources.mjs";
import { countInWords, esc, plural } from "../../_text.mjs";
import { reviewPointKind, reviewPointOrder } from "../lib/structure-model.mjs";
import * as tabCountsPart from "./lib/tab-counts.mjs";
import { drawsRed, MARK, outwardFirst, SIZE_STEPS, tabData } from "./lib/tab-data.mjs";
import * as tabDomPart from "./lib/tab-dom.mjs";
import * as tabDrawingPart from "./lib/tab-drawing.mjs";
import * as tabLayoutPart from "./lib/tab-layout.mjs";
import * as tabPanelPart from "./lib/tab-panel.mjs";
import * as tabRoutesPart from "./lib/tab-routes.mjs";
import * as tabWordsPart from "./lib/tab-words.mjs";

// JSON inside a script element: `<` never closes it, and the two line separators never end a JS line
const jsonInScript = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
// the table's Entry cell: a module's entry, or each of its several root files in red, the ones over the page cap counted
const entryCell = (m) => (m.rootFiles.length > 1
  ? [...m.rootFiles.map((f) => `<span class="bad">${esc(f)}</span>`), ...(m.rootFilesCut ? [`${m.rootFilesCut} more over the page cap`] : [])].join("<br>")
  : esc(m.entry || ""));

// The lede: what the drawing holds, one fact a line. The modules and the red line always show, in words at zero; every
// other line only when its count is not zero.
function ledeHtml(view) {
  // every dependency is between the top view's boxes or inside one
  const t = tabCountsPart.drawingTotals(view), out = t.out + t.insideOut, exc = t.exc + t.insideExc, dependencyWords = tabWordsPart.dependencyWords;
  const roots = view.modules.filter((m) => m.rootFiles.length > 1).length, point = tabWordsPart.reviewPointWords(t.earliest), mixed = (view.mixed || []).length;
  const cuts = [
    view.outside ? `${dependencyWords(view.outside)} leaving the code read` : "",
    view.notDrawn ? `${dependencyWords(view.notDrawn)} to modules over the page's cap` : "",
    view.cut.modules ? `${plural(view.cut.modules, "module")} over the page's cap` : "",
    view.cut.edges ? `${dependencyWords(view.cut.edges)} over the page's cap` : "",
    view.cut.decls ? `${plural(view.cut.decls, "declaration")} over the page's cap` : "",
    view.cut.files ? `${plural(view.cut.files, "file")} over the page's cap` : "",
    view.cut.relations ? `${plural(view.cut.relations, "declared relation")} over the page's cap` : "",
    view.unresolved ? `${plural(view.unresolved, "declared relation")} naming no drawn module` : "",
    view.cut.cycles ? `${plural(view.cut.cycles, "cycle")} over the check's cap` : "",
  ].filter(Boolean);
  const lines = [
    countInWords(view.modules.length, "No modules", "module") + (view.loose.length ? `, and ${plural(view.loose.length, "file")} outside any module` : ""),
    out ? `${plural(out, "dependency on an outer level", "dependencies on an outer level")}, drawn red` : "No dependencies on an outer level",
    exc ? `${dependencyWords(exc)} covered by an exception, drawn orange${point ? `; the first review point is ${point}` : ""}` : "",
    mixed ? `${plural(mixed, "file")} on several levels (drawn red, or orange when an exception covers them)` : "",
    roots ? `${plural(roots, "module")} with several root files, drawn red` : "",
    view.cycles.length ? `${plural(view.cycles.length, "cycle")} among modules, marked on their boxes` : "",
    cuts.length ? `Not drawn: ${cuts.join("; ")}` : "",
  ].filter(Boolean);
  return `<ul class="sv-lede">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

// The key: each mark the drawing can show, one line each, whether or not this drawing has one; a line is its parts, each
// [the mark, drawn bold, then what it means].
const KEY = [
  [["Bands", " are the levels, outermost on top. Two levels in one band, drawn with a | between them, may not use each other."]],
  [["A module", " spans the bands its files and nested modules are in. The line down a module's left edge is solid beside each level the module has files on, and dashed beside a level it only passes through, with no files there."]],
  [["A file outside any module", " is a box of its own in its level's band."]],
  [["+ \u2212 «type»", ": an exported name, a private one, a type: UML's marks."]],
  [["1 of 12 reached", ": the files code outside the module uses; a deep module's is 1, its entry. The bar under it shows the share."]],
  [["past the interface", ": files code outside reaches around the entry, red on the bar."]],
  [["shallow?", ": a module whose only file is its entry."]],
  [["Several root files", ": a module with more than one root file has no entry; the check reports them, and the module is drawn red."]],
  [["cycle", ": a tag on a module's box when it and other modules use one another in a loop; hover the tag for them."]],
  [["A file on several levels", " spans their bands: red, or orange when an exception covers it."]],
  [["An arrow", " stands for the dependencies between two boxes; hover or select it for how many. It leaves at the band most of them start in, and enters where most end."]],
  [["Red", ", outward: a dependency on an outer level, or on the other level of its band; "], ["orange", ": an exception covers it, until its review point; "], ["grey", ": inward."]],
  [["A dashed arrow", ": a dependency on types only; "], ["a triangle head", ": implements or inherits."]],
  [["17 dependencies inside", ": what a module's box hides between its own files."]],
  [["used by 5 · depends on 2", ": a file box's dependencies, the ones on it and the ones from it."]],
  [["A chip", " on a box's edge, inside a module: what the box uses outside the view; "], ["+N more", " when they do not fit."]],
  [["A declared relation", ": a line with UML's marks, a diamond for an aggregation or a composition, an open head otherwise."]],
];
// The key, a group of the page's (tabs-client.mjs, restoreGroup): drawn open, it opens on a first visit; a click on its
// line closes it, and the browser keeps that choice as it keeps the page's other groups'.
const keyHtml = () => `<details class="group sv-key" id="marks-key" open><summary><span class="t">What the marks mean</span></summary><ul>${KEY.map((parts) => `<li>${parts.map(([mark, says]) => `<strong>${esc(mark)}</strong>${esc(says)}`).join("")}</li>`).join("")}</ul></details>`;

// The section: the lede, the structure's files the page could not read (`unread`, each { where, what }), the key, the
// drawing with its detail beside it, and the modules as a table in the page's scroll box. `src` is the relative path
// from the page to the repository root, for the detail column's links.
function structureHtml(view, unread, sources, src = "") {
  // a module's span, outermost first: its entry's level and every level its files and nested modules hold
  const levelsOf = (m) => (m.lv.length ? tabWordsPart.levelNames(m.lv, view.rings) : m.level || "no level");
  const bad = unread.length
    ? `<details class="sv-unread"><summary>${plural(unread.length, "file")} of the structure could not be read</summary><ul>${unread.map((m) => `<li><span class="mono">${esc(m.where)}</span> — ${esc(m.what)}</li>`).join("")}</ul></details>`
    : "";
  const rows = view.modules.map((m) => `<tr><td class="mono">${esc(m.p)}</td><td>${esc(levelsOf(m))}</td><td class="mono">${entryCell(m)}</td><td class="num">${m.total == null ? "—" : `${countInWords(m.reached, "none")} of ${m.total}`}${m.pastInterface ? ` <span class="sv-past">${m.pastInterface} past the interface</span>` : ""}</td></tr>`).join("");
  return [
    `<h2>Levels and modules</h2>`,
    `<p class="s">${sources}</p>`,
    ledeHtml(view),
    bad,
    keyHtml(),
    `<div class="sv" id="sv" data-src="${esc(src)}">`,
    `<div class="sv-bar"><span class="sv-crumb" id="sv-crumb"></span><span class="sv-count" id="sv-count"></span><span class="sv-ctl"><span class="sv-seg" role="group" aria-label="Arrows"><button type="button" data-ar="bad" aria-pressed="true">Violations</button><button type="button" data-ar="all" aria-pressed="false">All arrows</button><button type="button" data-ar="selected" aria-pressed="false">Selected</button></span><button type="button" class="sv-btn" data-z="out" aria-label="Zoom out">−</button><button type="button" class="sv-btn" data-z="in" aria-label="Zoom in">+</button><button type="button" class="sv-btn" data-z="fit">Fit</button></span></div>`,
    `<div class="sv-main"><div class="sv-wrap"><div class="sv-stage" id="sv-stage"><svg id="sv-svg" role="group" aria-label="Modules by level"><g id="sv-world"></g></svg></div></div><aside class="sv-side" id="sv-side"></aside></div>`,
    `<div class="sv-tip" id="sv-tip"></div>`,
    `</div>`,
    `<script type="application/json" id="sv-data">${jsonInScript(view)}</script>`,
    `<details class="sv-table"><summary>The modules as a table</summary><div class="scroll"><table><thead><tr><th>Module</th><th>Level</th><th>Entry</th><th>Reached from outside</th></tr></thead><tbody>${rows}</tbody></table></div></details>`,
  ].filter(Boolean).join("\n");
}

// The Architecture tab's part of The Road's page, from the structure report (structure-report.mjs): { atop, the report's lines
// the tab opens on, or ""; html, the drawing's section; css; js; leftOut, whether the drawing was left out }. `sizeStep`
// indexes `sizeSteps`, the tab's own SIZE_STEPS when not given; past the last step the section only says the drawing is
// left out, under the page's `cap`. `linkBase` starts the links to the structure files.
export function architectureTab(report, { sizeStep, linkBase, cap, sizeSteps = SIZE_STEPS }) {
  const src = (f) => `<a href="${esc(linkBase + f)}">${esc(f)}</a>`;
  const [rules, graph] = ["docs/roadkeeper/dependency-rules.md", "docs/roadkeeper/structure.json"].map(src);
  const lines = report.check.atop;
  const atop = lines.length ? `<p class="unread report">${lines.map(esc).join("<br>")}</p>` : "";
  if (sizeStep >= sizeSteps.length) {
    const unread = report.unread.length ? `; ${report.unread.length} of its files could not be read` : "";
    return { atop, html: `<h2>Levels and modules</h2><p class="note">The structure is too large to draw under the page's ${cap / 1024 / 1024} MB cap and is left out${unread}: ${rules} and ${graph} hold it.</p>`, css: "", js: "", leftOut: true };
  }
  const view = tabData(report.model, sizeSteps[sizeStep], report.check);
  return { atop, html: structureHtml(view, report.unread, `${rules} · ${graph}`, linkBase), css: STRUCTURE_CSS, js: STRUCTURE_JS, leftOut: false };
}

// The drawing's style: it paints from the token file's names, the page's own (scripts/road/tokens.css), which
// follow the page's theme switch.
const STRUCTURE_CSS = `
  .sv-lede { margin: 6px 0 10px; padding-left: 20px; }
  .sv-lede li { margin: 2px 0; }
  /* the key keeps the group's look, its line flush left; from the page's own breakpoint its lines run in two columns */
  .group.sv-key > summary { grid-template-columns: 1fr; }
  .group.sv-key > summary .t { grid-column: 1; }
  .sv-key ul { margin: 4px 0 10px; padding-left: 20px; font-size: 13.5px; }
  .sv-key li { margin: 0 0 4px; break-inside: avoid; }
  .sv-key strong { font-weight: 600; }
  @media (min-width: 860px) { .sv-key ul { column-count: 2; column-gap: 32px; } }
  .sv { position: relative; left: 50%; transform: translateX(-50%); width: min(1500px, calc(100vw - 32px)); margin: 14px 0 10px; background: var(--ground); color: var(--ink); border: 1px solid var(--line); font: 14px/1.45 var(--body); }
  .sv-bar { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); background: var(--paper); }
  .sv-crumb { font-weight: 500; font-size: 14px; }
  .sv-crumb button { font: inherit; color: var(--accent); background: none; border: 0; padding: 0; cursor: pointer; }
  .sv-crumb button:hover { text-decoration: underline; }
  .sv-count { font-size: 12.5px; color: var(--muted); }
  .sv-count b.bad { color: var(--bad); } .sv-count b.exc { color: var(--warn); }
  .sv-ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-left: auto; }
  .sv-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .sv-seg button, .sv-btn { border: 0; background: transparent; color: var(--ink); padding: 4px 9px; font: inherit; font-size: 12.5px; cursor: pointer; }
  .sv-btn { border: 1px solid var(--line); border-radius: 6px; }
  .sv-seg button[aria-pressed="true"] { background: var(--ink); color: var(--ground); }
  .sv button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .sv-stage { position: relative; overflow: hidden; cursor: grab; height: max(460px, 72vh); touch-action: none; }
  .sv-stage.drag { cursor: grabbing; }
  /* the drawing holds the wheel only once a click on it or its toolbar has given it, and shows the page's focus ring while
     it does: a layer over the drawing, which would cover the stage's own outline */
  .sv-stage:focus { outline: none; }
  .sv-stage.held::after { content: ""; position: absolute; inset: 0; border: 2px solid var(--accent); pointer-events: none; }
  .sv-stage svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; user-select: none; -webkit-user-select: none; }
  .sv-side { border-top: 1px solid var(--line); background: var(--paper); padding: 14px 16px; font-size: 13px; scroll-margin-bottom: 16px; }
  /* from the page's own breakpoint the detail is a column beside the stage, from its top: its size contained, so the
     stage alone sets the row's height and the column scrolls inside it; narrower, it sits under the drawing */
  @media (min-width: 860px) {
    .sv-main { display: grid; grid-template-columns: minmax(0, 1fr) 300px; }
    .sv-side { border-top: 0; border-left: 1px solid var(--line); contain: size; overflow-y: auto; }
  }
  .sv-side h3 { font-size: 15px; margin: 0 0 4px; font-style: italic; color: var(--accent); font-weight: 500; font-family: var(--body); overflow-wrap: anywhere; }
  .sv-side h4 { font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin: 14px 0 4px; font-weight: 600; font-family: var(--body); }
  .sv-side ul { list-style: none; margin: 0; padding: 0; }
  .sv-side li { font: 12px/1.55 var(--mono); overflow-wrap: anywhere; }
  .sv-side li.bad { color: var(--bad); } .sv-side li.exc { color: var(--warn); }
  .sv-side li.grp { font-family: var(--body); margin-top: 4px; }
  .sv-side a { color: var(--accent); }
  .sv-side .note { color: var(--muted); font-size: 12px; margin: 4px 0 0; }
  .sv-side ul.moves li { font: 13px/1.5 var(--body); margin-bottom: 4px; }
  .sv-side ul.moves b { font-weight: 600; }
  /* SVG paints black where a name is undefined: with the token file unread, a ground falls back to none, and a line, a
     mark or text to the text's own colour, so the drawing stays readable, uncoloured */
  .sv .band { fill: var(--band, none); } .sv .band.alt { fill: var(--ground, none); }
  .sv .lvl { font: 600 11px var(--body); letter-spacing: .07em; text-transform: uppercase; fill: var(--muted, currentColor); }
  .sv .card .body { fill: var(--paper, none); stroke: var(--card-edge, currentColor); stroke-width: 1.2; }
  .sv .card.pkg .body { fill: var(--package, none); stroke: var(--card-edge, currentColor); }
  .sv .card.span .body { stroke-width: 1.4; }
  .sv .card.bad .body { stroke: var(--bad, currentColor); } .sv .card.exc .body { stroke: var(--warn, currentColor); }
  .sv .card.sel .body { stroke: var(--accent, currentColor); stroke-width: 2.6; }
  .sv .card:hover .body { stroke: var(--ink, currentColor); }
  .sv .card .title { fill: var(--ink, currentColor); font: 500 13.5px var(--body); }
  .sv .card.pkg .title { fill: var(--accent, currentColor); font: italic 500 14px var(--body); }
  .sv .card .rule { stroke: var(--card-edge, currentColor); stroke-width: 1; }
  .sv .card .ln { fill: var(--ink, currentColor); font: 12px var(--mono); }
  .sv .card .ln.priv, .sv .card .ln.more, .sv .card .ln.type { fill: var(--muted, currentColor); }
  .sv .card .lvtag { fill: var(--muted, currentColor); font: 10.5px var(--mono); }
  .sv .card .stat { fill: var(--muted, currentColor); font: 11px var(--body); }
  .sv .card .stat .bad { fill: var(--bad, currentColor); font-weight: 600; } .sv .card .stat .exc { fill: var(--warn, currentColor); font-weight: 600; }
  .sv .card .strip.occ { fill: var(--accent, currentColor); } .sv .card .strip.gap { stroke: var(--accent, currentColor); stroke-width: 4; stroke-dasharray: 5 4; }
  .sv .card .gauge-rest { fill: var(--card-edge, currentColor); opacity: .35; }
  .sv .card .gauge-ok { fill: var(--accent, currentColor); }
  .sv .card .gauge-past { fill: var(--bad, currentColor); }
  .sv .card .chip rect { fill: var(--chip, none); stroke: var(--card-edge, currentColor); stroke-width: 1; }
  .sv .card .chip.bad rect { stroke: var(--bad, currentColor); } .sv .card .chip.exc rect { stroke: var(--warn, currentColor); }
  .sv .card .chip text { fill: var(--muted, currentColor); font: 10.5px var(--mono); }
  .sv .card .chip.bad text { fill: var(--bad, currentColor); } .sv .card .chip.exc text { fill: var(--warn, currentColor); }
  .sv .card .cyc rect { fill: none; stroke: var(--bad, currentColor); stroke-dasharray: 3 2; } .sv .card .cyc text { fill: var(--bad, currentColor); font: 600 10.5px var(--body); }
  .sv .card .part rect { fill: var(--paper, none); stroke: var(--card-edge, currentColor); stroke-width: 1; }
  .sv .card .part text { fill: var(--ink, currentColor); font: 11px var(--mono); }
  .sv .card .part:hover rect { stroke: var(--ink, currentColor); } .sv .card .part.sel rect { stroke: var(--accent, currentColor); stroke-width: 2; }
  .sv .card .stub { stroke: var(--card-edge, currentColor); stroke-width: 1; } .sv .card .stub.bad { stroke: var(--bad, currentColor); } .sv .card .stub.exc { stroke: var(--warn, currentColor); }
  .sv .card { cursor: pointer; } .sv .card:focus { outline: none; } .sv .card:focus .body { stroke: var(--accent, currentColor); }
  .sv .edge { fill: none; stroke: var(--muted, currentColor); stroke-width: 1.3; opacity: .75; }
  .sv .edge.type, .sv .edge.impl { stroke-dasharray: 5 4; }
  .sv .edge.rel { stroke: var(--accent, currentColor); }
  .sv .edge.bad { stroke: var(--bad, currentColor); opacity: .95; } .sv .edge.exc { stroke: var(--warn, currentColor); opacity: .95; }
  .sv .edge.hot { stroke-width: 2.4; opacity: 1; } .sv .edge.bad.hot { stroke: var(--bad-hot, currentColor); }
  .sv .edge.dim { opacity: .25; }
  .sv .edge-hit { fill: none; stroke: transparent; stroke-width: 12; cursor: pointer; }
  /* a focused arrow: an accent halo under its line, which keeps its own colour and width */
  .sv .arrow:focus { outline: none; }
  .sv .edge-halo { fill: none; stroke: none; pointer-events: none; }
  .sv .arrow:focus-visible .edge-halo { stroke: var(--accent, currentColor); stroke-width: 7; opacity: .35; }
  .sv marker path { fill: none; stroke: var(--muted, currentColor); stroke-width: 1.4; }
  .sv marker.bad path { stroke: var(--bad, currentColor); } .sv marker.exc path { stroke: var(--warn, currentColor); } .sv marker.rel path { stroke: var(--accent, currentColor); }
  .sv marker path.solid { fill: var(--ground, none); } .sv marker path.fill { fill: var(--accent, currentColor); }
  .sv-tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--ground); font: 12px/1.4 var(--mono); padding: 6px 8px; border-radius: 4px; max-width: 520px; display: none; z-index: 9; }
  .sv-past, .sv-table .bad { color: var(--bad); font-weight: 500; }
  .sv-unread { margin: 8px 0; color: var(--warn); }
  .sv-table { margin: 6px 0 18px; }
  .sv-table table { border-collapse: collapse; font-size: 13px; width: 100%; }
  .sv-table th, .sv-table td { text-align: left; vertical-align: top; padding: 4px 8px; border-bottom: 1px solid var(--line); }
  .sv-table td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sv-table th:last-child { white-space: nowrap; }
`;

// The originals the parts call, by their source, MARK as JSON; each names only what the page's script also holds.
const ORIGINALS = [`const MARK = ${JSON.stringify(MARK)};`, ...[plural, countInWords, reviewPointKind, reviewPointOrder, drawsRed, outwardFirst].map((f) => f.toString())].join("\n");
// The page's script: the originals, then every function of the parts, each by its own source, then the client called
// once, in one function scope of their own, so no name reaches the page's. Its value is the drawing's one entry,
// tabDrawing: a suite runs this text and calls it.
const STRUCTURE_JS = `(function(){\n${ORIGINALS}\n${[tabCountsPart, tabWordsPart, tabPanelPart, tabLayoutPart, tabRoutesPart, tabDrawingPart, tabDomPart].map(functionSources).join("\n")}\ntabDom();\nreturn tabDrawing;\n})();`;
