// @level presentation
// Roadkeeper — the Architecture tab's drawing, the client's one embedded entry: tabDrawing, given the view's data
// (tabData, tab-data.mjs) and a text measure, counts and decides everything the client (tab-dom.mjs) draws. Pure:
// it reads nothing and writes nothing outside itself, keeping only each view's last routes; the measure is the page's
// canvas, fixed widths in a suite.
//
// The page embeds each function here by its own source (architecture-tab.mjs), in one scope with its five parts': the
// counting (tab-counts.mjs), the words (tab-words.mjs), the detail (tab-panel.mjs), the geometry (tab-layout.mjs) and
// the routes (tab-routes.mjs).

import { drawingOf } from "./tab-counts.mjs";
import { MARK } from "./tab-data.mjs";
import { arrowLook, bandWords, boxContent, boxSize, layoutBoxes, layoutOptions, placeBox, relationMarker, shownRows, spanOf } from "./tab-layout.mjs";
import { panelOf } from "./tab-panel.mjs";
import { viewRoutes } from "./tab-routes.mjs";
import { arrowWords, chipWords, countWords, cycleLines, levelNames, pageOf } from "./tab-words.mjs";

// The drawing of the view's data `V`, `measure(text, role)` giving a text's width in a role's font: title, pkg (a
// module's title), stat (a box's header), line (a card's line), chip (an outside chip and a box's info),
// part (a nested module's chip). Returns:
// - size: a card's line and its chips' sizes;
// - node(id): a tree node, { id, kind, label, parent, lv }, or undefined;
// - scene(view), null for the top: sceneOf; count(view, how), its count line: countOf;
// - panel(sel), the detail beside the drawing; shown(e, mode, sel), whether an arrow shows, is a Tab stop and is in the
//   accessibility tree; tip(a, edge), the lines an arrow's tip shows: arrowTip;
//   fit(width, winH, scene), zoom(T, point, f), wheel(T, w, point), kept(T, scene, stage) and dragged(dx, dy), the view's moves; takesWheel(held),
//   whose a wheel turn is, turnOrNull(held, w, place), the view a turn leaves or null for the page's, and
//   heldAfter(held, move, at), whether the drawing holds the wheel after a press or a focus move; escape(sel) and
//   open(id), what Esc and opening a node do; scrollsToDetail(stage, side), whether showing a node's detail scrolls the
//   page; openingButton(), the arrows toggle's button the drawing opens on, and toggleAfter(toggle, selection), the
//   toggle after the selection changes.
export function tabDrawing(V, measure) {
  // a card shows twelve lines of 16px, its 12px text with leading; a part chip is 20px tall, its 11px label with room
  // above and below and 7px left and right, and 5px apart, so two chips' outlines never touch; an outside chip is 18px
  // tall, its 10.5px label 6px from its left and right, and 6px apart and from its box's edges
  var LOOK = { size: { lines: 12, lineH: 16, partH: 20, partGap: 5, partPad: 7, chipH: 18, chipPad: 6, chipGap: 6 } };
  var D = drawingOf(V), PG = pageOf(V, D, LOOK), drawing = { V: V, measure: measure, look: LOOK, D: D, pg: PG, routes: Object.create(null) };
  return {
    size: LOOK.size, node: function (id) { return PG.N[id]; }, scene: function (view) { return sceneOf(drawing, view); },
    count: function (view, how) { return countOf(drawing, view, how); },
    panel: function (sel) { return panelOf(sel, PG); }, shown: arrowShown, tip: arrowTip, fit: fitOf, zoom: zoomAt, wheel: wheelView, kept: keptInStage,
    takesWheel: drawingTakesWheel, turnOrNull: wheelTurnOrNull, heldAfter: wheelHeldAfter, dragged: dragMoved,
    escape: escapeStep, open: function (id) { return openStep(PG.N[id]); },
    scrollsToDetail: scrollsToDetail, openingButton: function () { return openingButton(D.view(null)); }, toggleAfter: toggleAfter,
  };
}

// placedBox: sized box `b` given its place in the layout `L` (P), its insides placed there (at) and what its tips say;
// `drawing` is tabDrawing's.
export function placedBox(b, L, drawing) {
  var PG = drawing.pg;
  b.P = L.P[b.id]; b.at = placeBox(b, b.P, L);
  b.cycleTip = b.cy ? [b.title].concat(cycleLines(b.cy, drawing.V.cycles)) : null;
  for (var r in b.pf) b.pf[r].chips.forEach(function (c) { c.tip = [c.it.id, levelNames(PG.N[c.it.id].lv, PG.rings)]; });
  b.row.chips.forEach(function (c) { c.tip = chipWords(b.title, c.ch); });
}
// countOf: view `view`'s count line (countWords) as the arrows toggle and the selection `how` ({ mode, selected, edge })
// leave it.
export function countOf(drawing, view, how) {
  return countWords(drawing.D.view(view), drawing.pg, { view: view, mode: how.mode, selected: how.selected, edge: how.edge });
}
// sceneOf: view `view` of `drawing` (tabDrawing's), null for the top: its bands, top to bottom, each { y, h,
// names }; its boxes in order, each sized, placed (P) and with its insides placed (at), its tips said; its arrows,
// each { e, d, look, words, access }, the arrow's file edges in e; the declared relations drawn, each { r, d, at, url,
// tip, access }; the totals; the width and height. Each arrow's and relation's path d is routed around the boxes, all
// together once for the view's layout (viewRoutes; `drawing` keeps each view's last routes), so the toolbar, a
// selection and a hover only show, hide or light a line, never move one. No arrow draws its count: its tip and its
// name say it. What the accessibility tree reads, access: an arrow is a button named by its tip's first line; a
// relation is an image named by its tip.
export function sceneOf(drawing, view) {
  var V = drawing.V, PG = drawing.pg, measure = drawing.measure, key = view == null ? '' : view;
  var agg = drawing.D.view(view), boxes = agg.boxes.map(function (x) { return boxSize(boxContent(x, PG), PG, measure); });
  var rows = shownRows(view != null ? spanOf(PG.N[view].lv, PG.rows, PG.none) : null, boxes, PG.none);
  var L = layoutBoxes(boxes, rows, layoutOptions(boxes, V.rings)), arrows = [], relations = [];
  drawing.routes[key] = viewRoutes(drawing.routes[key], agg.arrows.concat(V.relations.map(function (r) { return relationEnds(r, L); })), L);
  var paths = drawing.routes[key].paths;
  boxes.forEach(function (b) { placedBox(b, L, drawing); });
  agg.arrows.forEach(function (p, i) {
    if (!paths[i]) return;
    var words = arrowWords(p, PG);
    arrows.push({ e: p, d: paths[i], look: arrowLook(p, V.kinds), words: words, access: { role: 'button', name: words.tip[0] } });
  });
  V.relations.forEach(function (r, k) {
    var d = paths[agg.arrows.length + k], mark = relationMarker(r), tip = r.a + ' → ' + r.b + ' · ' + r.k + ' (declared)';
    if (d) relations.push({ r: r, d: d, at: mark.at, url: mark.url, tip: tip, access: { role: 'img', name: tip } });
  });
  return {
    width: L.width, height: L.height, boxes: boxes, arrows: arrows, relations: relations,
    bands: rows.map(function (r) { return { y: L.top[r], h: L.rowH[r], names: bandWords(r, V.rings) }; }),
    totals: agg.totals,
  };
}
// relationEnds: declared relation `r` as a line between its boxes, leaving and entering at their top bands, in the
// layout `L`, marked a relation (rel); a box not placed gives no band.
export function relationEnds(r, L) {
  var a = L.P[r.a], b = L.P[r.b];
  return { from: r.a, to: r.b, rf: a ? a.b.top : null, rt: b ? b.b.top : null, rel: true };
}

// arrowShown: whether an arrow shows, hot or dim, and is a Tab stop, by the arrows toggle (`mode`: bad, all, selected)
// and what is hovered and selected (`sel`: { hover, selected, edge }). The focus is the hovered and the selected box
// together: their arrows and the selected arrow always show, hot; the rest dim while anything has the focus, unless the
// toggle shows only those. A shown arrow is a Tab stop; a declared relation (`e.rel`) never is. An arrow or a relation
// not shown is out of the accessibility tree too (ariaHidden).
export function arrowShown(e, mode, sel) {
  var on = function (b) { return b != null && (e.from === b || e.to === b); };
  var f = sel.hover != null || sel.selected != null, t = on(sel.hover) || on(sel.selected), s = sel.edge === e;
  var shown = mode === 'all' || (mode === 'bad' && (e.mark > MARK.inward || e.rel)) || t || s;
  return { shown: shown, hot: t || s, dim: (f || !!sel.edge) && !t && !s && mode !== 'selected', tabStop: shown && !e.rel, ariaHidden: !shown };
}
// arrowTip: the lines scene arrow `a`'s tip shows, `edge` the selected arrow's file edges or null: its words' tip, and
// the line asking for a click while it is not the one selected, whose file pairs the detail already lists.
export function arrowTip(a, edge) {
  return a.e === edge ? a.words.tip : a.words.tip.concat([a.words.ask]);
}
// fitMargin: what Fit leaves between a drawing and the stage's edge; a move may pull a drawing larger than the stage as
// far past its edge (keptInStage), so the floor keeps Fit's own view.
export function fitMargin() {
  return 10;
}
// fitOf: the zoom that fits a drawing's width within fitMargin each side — at most FIT_UP, and at least a fifth, where
// a card's names stop being legible — and the stage's height: the drawing's, within 380 px and 85% of the window, so the
// stage stays on one screen; a taller drawing shrinks, down to FIT_DOWN, and the wheel scrolls the rest. Its view goes
// through the floor, so the first move never jumps.
export function fitOf(width, winH, scene) {
  // FIT_ROOM: the 12px top offset and as much below the last band
  // FIT_UP: a small drawing grows at most this much, so its 12px lines stay near the page's own 14px text
  // FIT_DOWN: a tall drawing shrinks at most to this, its 12px lines still 7px and readable
  var FIT_ROOM = 24, FIT_UP = 1.15, FIT_DOWN = 0.6, margin = fitMargin();
  var k = Math.min(FIT_UP, Math.max(0.2, (width - 2 * margin) / scene.width)), H = Math.max(380, Math.min(winH * 0.85, scene.height * k + FIT_ROOM));
  if (scene.height * k + FIT_ROOM > H) k = Math.min(k, Math.max(FIT_DOWN, (H - FIT_ROOM) / scene.height));
  var T = keptInStage({ k: k, x: Math.max(margin, (width - scene.width * k) / 2), y: 12 }, scene, { width: width, height: H });
  return { k: T.k, x: T.x, y: T.y, H: H };
}
// zoomAt: the view `T` zoomed by `f` about `point`, which stays put; the zoom stays within 0.15 and 2.5.
export function zoomAt(T, point, f) {
  var k = Math.min(2.5, Math.max(0.15, T.k * f));
  return { k: k, x: point.x - (point.x - T.x) * k / T.k, y: point.y - (point.y - T.y) * k / T.k };
}
// dragMoved: whether a pointer moved `dx`, `dy` from where it went down far enough to drag: past 4 px, so a click that
// slips a little still selects.
export function dragMoved(dx, dy) {
  return Math.abs(dx) + Math.abs(dy) > 4;
}
// wheelView: the view `T` after a wheel turn `w` ({ deltaX, deltaY, shiftKey, ctrlKey, metaKey }) over `point`:
// ctrl or cmd zooms about the point, shift scrolls sideways, else it scrolls both ways.
export function wheelView(T, w, point) {
  if (w.ctrlKey || w.metaKey) return zoomAt(T, point, Math.exp(-w.deltaY * 0.0015));
  if (w.shiftKey) return { k: T.k, x: T.x - (w.deltaY || w.deltaX), y: T.y };
  return { k: T.k, x: T.x - w.deltaX, y: T.y - w.deltaY };
}
// drawingTakesWheel: whether a wheel turn is the drawing's: only while it `held` the wheel (wheelHeldAfter); the keys
// held with the turn, ctrl and cmd included, never take it from the page.
export function drawingTakesWheel(held) {
  return held === true;
}
// wheelTurnOrNull: the view after a wheel turn `w` on the drawing at `place` ({ T, point, scene, stage }: its view,
// the pointer's point, the drawing and its stage), or null when the turn is the page's. Only while the drawing `held`
// the wheel: ctrl or cmd zooms it; else the turn scrolls it only in a direction in which it overflows the stage
// (overflowsStage), as far as its edge (keptInStage), and a turn that moves it nowhere is the page's, so the page
// scrolls on.
export function wheelTurnOrNull(held, w, place) {
  var T = place.T, scene = place.scene, stage = place.stage, zooms = w.ctrlKey || w.metaKey;
  if (!drawingTakesWheel(held)) return null;
  var to = wheelView(T, w, place.point);
  var scrollsAcross = zooms || overflowsStage(scene.width * T.k, stage.width);
  var scrollsDown = zooms || overflowsStage(scene.height * T.k, stage.height);
  var next = keptInStage({ k: to.k, x: scrollsAcross ? to.x : T.x, y: scrollsDown ? to.y : T.y }, scene, stage);
  if (zooms) return next;
  return next.x === T.x && next.y === T.y ? null : next;
}
// wheelHeldAfter: whether the drawing holds the wheel, `held` before, after a 'press' or a 'focus' move lands `at`: the
// 'drawing', its 'toolbar' (−, +, Fit and the arrows toggle) or elsewhere on the 'page'. A press on the drawing or its
// toolbar takes the wheel or keeps it; the focus moving in keeps what it was, so Tab alone never takes it; a press or
// the focus anywhere else gives it back.
export function wheelHeldAfter(held, move, at) {
  if (at !== 'drawing' && at !== 'toolbar') return false;
  return move === 'press' || held === true;
}
// keptInStage: the view `T` kept at its content's edge, the drawing `scene` ({ width, height }) at T.k on a stage
// ({ width, height }), each way apart: larger than the stage, it passes its edge by at most fitMargin; smaller, it stays
// inside the stage.
export function keptInStage(T, scene, stage) {
  var margin = fitMargin();
  function kept(at, size, room) {
    var overflows = overflowsStage(size, room), lo = overflows ? room - size - margin : 0, hi = overflows ? margin : room - size;
    return Math.min(hi, Math.max(lo, at));
  }
  return { k: T.k, x: kept(T.x, scene.width * T.k, stage.width), y: kept(T.y, scene.height * T.k, stage.height) };
}
// overflowsStage: whether a drawing `size` long, at its scale, one way, is longer than its stage's `room` that way.
export function overflowsStage(size, room) {
  return size > room;
}
// openingButton: the arrows toggle's button the drawing opens on, by the top view `view` (drawingView), its lines not
// routed: Violations ('bad') when an arrow between two of its drawn boxes is red or orange, else All arrows ('all'); a
// declared relation does not count.
export function openingButton(view) {
  var drawn = Object.create(null);
  view.boxes.forEach(function (b) { drawn[b.id] = true; });
  return view.arrows.some(function (p) { return drawn[p.from] && drawn[p.to] && p.mark > MARK.inward; }) ? 'bad' : 'all';
}
// toggleAfter: the arrows toggle `toggle` ({ mode, pressedBySelection }) after the selection becomes `selection`
// ({ selected, edge }). A box or an arrow selected: Violations presses Selected, which the selection then holds. Nothing
// selected: Selected, while the selection holds it, presses Violations again. Any other button stays.
export function toggleAfter(toggle, selection) {
  if (selection.selected != null || selection.edge) return toggle.mode === 'bad' ? { mode: 'selected', pressedBySelection: true } : toggle;
  return toggle.mode === 'selected' && toggle.pressedBySelection ? { mode: 'bad', pressedBySelection: false } : toggle;
}
// escapeStep: what Esc does with `sel` ({ edge, selected }): 'clear' a selected arrow or node first, else go 'up'.
export function escapeStep(sel) {
  return sel.edge || sel.selected != null ? 'clear' : 'up';
}
// openStep: what opening a node does: a file 'show's its detail, a module is 'enter'ed as a view.
export function openStep(node) {
  return node.kind === 'file' ? 'show' : 'enter';
}
// scrollsToDetail: whether showing a node's detail scrolls the page to it, by where the stage and the detail sit (each
// a box, { top, bottom }): only while the detail sits under the drawing, in a narrow window; beside it, the page stays still.
export function scrollsToDetail(stage, side) {
  return side.top >= stage.bottom;
}
