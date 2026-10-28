// @level presentation
// Roadkeeper — the Architecture drawing's geometry, a part of its one embedded entry (tabDrawing, tab-drawing.mjs): it sizes
// the boxes, lays them out in the bands, and gives an arrow's curve from box to box, spread where curves share a box's
// side, and a declared relation's straight line, which a line takes where it is not routed (tab-routes.mjs), and a
// declared relation's marker. Pure.
//
// The page embeds each function here by its own source, in one scope with the entry's (architecture-tab.mjs) and the
// words' (tab-words.mjs).

import { countInWords } from "../../../_text.mjs";
import { declLine, foldLines, insideLine, markClass, moduleCardLines, moreChipText, moreChipWords, skipNote } from "./tab-words.mjs";

// spanOf: the bands a set of levels holds (occ), and the first and last of them; a box spans every band between, the
// ones it only crosses included. No level holds the band past the rings.
export function spanOf(levels, rows, none) {
  var occ = [], seen = Object.create(null);
  for (var i = 0; i < levels.length; i++) {
    var r = levels[i] >= 0 && rows[levels[i]] != null ? rows[levels[i]] : null;
    if (r == null || seen[r]) continue;
    seen[r] = 1; occ.push(r);
  }
  if (!occ.length) occ.push(none);
  occ.sort(function (a, b) { return a - b; });
  return { top: occ[0], bot: occ[occ.length - 1], occ: occ };
}
// shownRows: the bands a view draws, top to bottom — the top view (`span` null) every ring, a module's view the rings
// its span covers — and any band a box holds, the no-level band among them.
export function shownRows(span, boxes, none) {
  var rs = [], lo = 0, hi = none - 1;
  if (span) { lo = span.top; hi = Math.min(span.bot, none - 1); }
  for (var r = lo; r <= hi; r++) rs.push(r);
  for (var i = 0; i < boxes.length; i++) for (var q = boxes[i].top; q <= boxes[i].bot; q++) if (rs.indexOf(q) < 0) rs.push(q);
  return rs.sort(function (a, b) { return a - b; });
}
// layoutBoxes: the bands as rows, `rows` top to bottom. A box spanning bands takes the first column on the left whose
// bands it spans are free and reaches from its top band's top to its bottom band's bottom; a one-band box flows in its
// band right of the columns, wrapped at o.rowW, a new line where its `sub` changes. A band is as tall as the most any
// box needs of it: box.need[row]. Each place keeps its box (b) and its whole height (H), a one-band box's chips below it.
// With the places, the bands' tops and heights and the drawing's size, it gives the spacing the routes read: where the
// boxes start (left), the gap between two columns (gx) and a band's padding (pad).
export function layoutBoxes(boxes, rows, o) {
  var pad = o.pad, P = Object.create(null), rowH = [], top = [], cols = [], multi = [], single = [], flow = Object.create(null);
  boxes.forEach(function (b) { (b.bot > b.top ? multi : single).push(b); });
  multi.forEach(function (b) {
    var c = null;
    for (var k = 0; k < cols.length && !c; k++) { var free = true; for (var q = b.top; q <= b.bot; q++) if (cols[k].used[q]) free = false; if (free) c = cols[k]; }
    if (!c) { c = { used: Object.create(null), boxes: [], w: 0 }; cols.push(c); }
    for (var q2 = b.top; q2 <= b.bot; q2++) c.used[q2] = 1;
    c.boxes.push(b); c.w = Math.max(c.w, b.w);
  });
  var colsW = cols.reduce(function (s, c) { return s + c.w + o.gx; }, 0), flowW = 0;
  rows.forEach(function (r) {
    var x = 0, y = 0, lh = 0, sub = null, place = [];
    single.forEach(function (b) {
      if (b.top !== r) return;
      if (x && (x + b.w > o.rowW || b.sub !== sub)) { x = 0; y += lh + o.gy; lh = 0; }
      sub = b.sub; place.push([b, x, y]); x += b.w + o.gx; lh = Math.max(lh, b.need[r] || 0); flowW = Math.max(flowW, x - o.gx);
    });
    flow[r] = { place: place, h: place.length ? y + lh : 0 };
  });
  var y0 = 0;
  rows.forEach(function (r) {
    var h = flow[r].h;
    multi.forEach(function (b) { if (r >= b.top && r <= b.bot) h = Math.max(h, b.need[r] || 0); });
    rowH[r] = Math.max(o.minRow, h + 2 * pad); top[r] = y0; y0 += rowH[r];
  });
  var x0 = o.left;
  cols.forEach(function (c) {
    c.boxes.forEach(function (b) {
      var y = top[b.top] + pad, h = top[b.bot] + rowH[b.bot] - pad - y;
      P[b.id] = { x: x0 + (c.w - b.w) / 2, y: y, w: b.w, h: h, H: h, b: b };
    });
    x0 += c.w + o.gx;
  });
  rows.forEach(function (r) { flow[r].place.forEach(function (p) { P[p[0].id] = { x: o.left + colsW + p[1], y: top[r] + pad + p[2], w: p[0].w, h: p[0].h || 0, H: p[0].H, b: p[0] }; }); });
  return { P: P, top: top, rowH: rowH, width: o.left + colsW + flowW + 40, height: y0, left: o.left, gx: o.gx, pad: pad };
}
// layoutOptions: the drawing's spacing — band padding, gaps between boxes, a left margin for the band's name — a band
// tall enough for its ring's names, and a row as wide as the boxes' area asks, within 1100 and 1700.
export function layoutOptions(boxes, rings) {
  var area = boxes.reduce(function (s, b) { return s + b.w * (b.H || b.body); }, 0);
  var peers = rings.reduce(function (n, r) { return Math.max(n, r.length); }, 1);
  return { pad: 16, left: 170, gx: 40, gy: 30, minRow: Math.max(56, 26 + 15 * peers), rowW: Math.max(1100, Math.min(1700, Math.sqrt(area) * 1.6)) };
}
// bandWords: a band's name, its lines — a ring's peers one per line, so a long ring's name stays left of the boxes; the
// band past the rings is "no level".
export function bandWords(r, rings) {
  var none = rings.length;
  if (r === none) return ['no level'];
  return rings[none - 1 - r].map(function (n, j) { return (j ? '| ' : '') + n; });
}
// cutText: `t` as it fits in `width`, `textW` measuring it: whole, or its longest start that fits with an ellipsis
// after it.
export function cutText(t, width, textW) {
  if (textW(t) <= width) return t;
  for (var k = t.length - 1; k > 0; k--) if (textW(t.slice(0, k) + '…') <= width) return t.slice(0, k) + '…';
  return '…';
}
// flowChips: part chips laid left to right in `width`, a new line where the next would pass it, `o.gap` apart; a chip
// wider than the width is cut to it, its text (t) cut with it to leave `o.pad` each side, `o.textW` measuring it.
export function flowChips(items, width, o) {
  var x = 0, line = 0, out = [];
  items.forEach(function (it) {
    var w = Math.min(width, it.w);
    if (x && x + w > width) { line++; x = 0; }
    out.push({ it: it, t: w < it.w ? cutText(it.t, w - 2 * o.pad, o.textW) : it.t, x: x, line: line, w: w }); x += w + o.gap;
  });
  return { chips: out, lines: items.length ? line + 1 : 0 };
}
// boxContent: what a box shows — a module's interface, its files reached from outside, gauge and skips; a file's
// declarations, a file no module holds its exported ones, and what uses it and what it depends on — at most pg.look.size.lines lines, the rest counted; its header, its
// cycles and its bands; red, or orange for a file of mixed levels an exception covers.
export function boxContent(x, pg) {
  var id = x.id, n = pg.N[id], m = pg.mods[id], max = pg.look.size.lines, lines, info, gauge = null;
  function lineOf(d) { return declLine(d, pg.declKinds); }
  if (n.kind === 'mod') {
    lines = moduleCardLines(m.entry, pg);
    info = (m.total != null ? countInWords(m.reached, 'none') + ' of ' + m.total + ' reached' : 'files not listed') + skipNote(m);
    if (m.total) gauge = { ok: (m.reached - m.pastInterface) / m.total, past: m.pastInterface / m.total };
  } else {
    var alone = n.parent == null, all = (pg.decl[id] || []).filter(function (d) { return !alone || d[2]; }), shown = all.slice(0, max).map(lineOf), nd = pg.node(id);
    var cut = alone ? pg.declExCut[id] : pg.declCut[id];
    lines = foldLines(shown, all.length - shown.length + (cut || 0), max); info = 'used by ' + countInWords(nd.edgesIn, 'none') + ' · depends on ' + countInWords(nd.edgesOut, 'none');
  }
  var sp = spanOf(n.lv, pg.rows, pg.none);
  return {
    id: id, kind: n.kind, pkg: n.kind !== 'file', title: n.label, info: info, lines: lines, gauge: gauge, chips: x.chips, stat: insideLine(x.inside),
    cy: m && m.cy.length ? m.cy : null, top: sp.top, bot: sp.bot, occ: sp.occ, sub: x.sub, bad: x.red, exc: !x.red && x.mixed === 2,
  };
}
// partsOf: a module box's nested modules, measured, each one part chip in its entry's band, as a module seen from
// outside has its entry's level; one whose entry names no level in the top band its files hold.
export function partsOf(b, pg, measure) {
  var byRow = Object.create(null), any = false, pad = pg.look.size.partPad;
  if (b.kind !== 'mod') return { byRow: byRow, any: any };
  (pg.kids[b.id] || []).forEach(function (k) {
    if (pg.N[k].kind !== 'mod') return;
    any = true;
    var own = pg.mods[k].l, r = spanOf(own >= 0 ? [own] : pg.N[k].lv, pg.rows, pg.none).top;
    (byRow[r] = byRow[r] || []).push({ id: k, t: pg.N[k].label, w: measure(pg.N[k].label, 'part') + 2 * pad });
  });
  return { byRow: byRow, any: any };
}
// boxSize: a box's size from what it shows (boxContent), `measure(text, role)` measuring its text: its width, header and
// body, its part chips flowed in each band, where its header's lines (headerY), text, cycle tag, gauge and chips go, and
// its class.
export function boxSize(c, pg, measure) {
  var S = pg.look.size, parts = partsOf(c, pg, measure), b = Object.create(null);
  for (var k in c) b[k] = c[k];
  var sw = c.stat.reduce(function (s, p) { return s + measure(p.t, 'stat'); }, 0), cw = measure('cycle', 'stat');
  var lineW = Math.max.apply(null, c.lines.map(function (l) { return measure(l.t, 'line') + 24; }).concat([0]));
  b.w = Math.min(320, Math.max(measure(c.title, c.pkg ? 'pkg' : 'title') + 24, measure(c.info, 'chip') + 24, 170, sw + (c.cy ? cw + 26 : 0) + 24, parts.any ? 220 : 0, lineW));
  b.spans = c.bot > c.top; b.x0 = b.spans ? 14 : 12; b.rx = c.pkg ? 8 : 4;
  b.cls = 'card' + (c.pkg ? ' pkg' : '') + (b.spans ? ' span' : '') + (c.bad ? ' bad' : '') + (c.exc ? ' exc' : '');
  b.statRow = c.stat.length > 0 || !!c.cy;
  // the header's lines, each by its y: the name's baseline, the counts' under it, the rule, the header line's under that
  var hy = { title: 23, counts: 39, rule: 46 }; hy.stat = hy.rule + 14; b.headerY = hy;
  b.head = b.statRow ? hy.stat + 4 : hy.rule; b.body = b.head + 6 + c.lines.length * S.lineH + 10 + (c.gauge ? 6 : 0);
  b.cyc = c.cy ? { x: b.x0 + sw + (sw ? 8 : 0), y: hy.stat - 11, w: cw + 12 } : null;
  b.gaugeAt = null;
  if (c.gauge) {
    var gw = b.w - 16 - (b.spans ? 6 : 0), gx = 8 + (b.spans ? 6 : 0);
    b.gaugeAt = { x: gx, y: b.body - 8, w: gw, okW: Math.max(0, gw * c.gauge.ok), pastX: gx + gw * c.gauge.ok, pastW: Math.max(0, gw * c.gauge.past) };
  }
  b.pf = Object.create(null);
  var partFlow = { gap: S.partGap, pad: S.partPad, textW: function (t) { return measure(t, 'part'); } };
  for (var r in parts.byRow) b.pf[r] = flowChips(parts.byRow[r], b.w - 20, partFlow);
  b.foot = c.chips.length ? 30 : 0;
  b.row = chipRow(b, pg, measure);
  return boxNeeds(b, S);
}
// boxNeeds: how tall a box is and what it needs of each band it spans: a one-band box its body, its part chips and its
// chips below (h without them, H with); a spanning box its body and chips in its top band, its chips in each band
// below, and its foot in its last.
export function boxNeeds(b, S) {
  var need = Object.create(null);
  function partsH(r) { return b.pf[r] && b.pf[r].lines ? b.pf[r].lines * (S.partH + S.partGap) + 6 : 0; }
  b.need = need;
  if (!b.spans) { b.h = b.body + partsH(b.top); b.H = b.h + b.foot; need[b.top] = b.H; return b; }
  need[b.top] = b.body + partsH(b.top);
  for (var q = b.top + 1; q <= b.bot; q++) need[q] = 10 + partsH(q) + (q === b.bot ? b.foot + 8 : 0);
  return b;
}
// chipRow: what a box reaches outside the view, as one row of chips under it, each labelled and classed by its mark,
// chipGap apart and from the box's edges. The chips past the box's width are counted: their mark (moreText, its tip
// moreTip) where the next would start, room kept for it. A first chip wider than its room is cut to it. The row ends
// at `end`, 0 with no chip.
export function chipRow(b, pg, measure) {
  var S = pg.look.size, x = S.chipGap, out = [], n = b.chips.length;
  function textW(t) { return measure(t, 'chip'); }
  for (var i = 0; i < n; i++) {
    var ch = b.chips[i], t = (pg.N[ch.t] ? pg.N[ch.t].label : ch.t) + ' ' + ch.n, w = textW(t) + 2 * S.chipPad;
    var room = b.w - S.chipGap - x - (i < n - 1 ? S.chipGap + textW(moreChipText(n - 1 - i)) : 0);
    if (w > room) {
      if (out.length) break;
      t = cutText(t, room - 2 * S.chipPad, textW); w = textW(t) + 2 * S.chipPad;
    }
    out.push({ ch: ch, t: t, x: x, w: w, cls: markClass(ch.mark) });
    x += w + S.chipGap;
  }
  var left = b.chips.slice(out.length), mark = left.length ? moreChipWords(b.title, left) : { t: '', tip: null }, end = out.length ? x - S.chipGap : 0;
  if (left.length) end = x + textW(mark.t);
  return { chips: out, more: left.length, moreX: left.length ? x : 0, moreText: mark.t, moreTip: mark.tip, end: end };
}
// placeBox: a placed box's insides that hang on its place `P` and the bands `L`: its body's height, its strips — solid
// (held) in a band it has files in, dashed in one it only passes through — where its part chips start in each band, and
// where its chips go.
export function placeBox(b, P, L) {
  var strips = [], partY = Object.create(null);
  if (b.spans) {
    for (var r = b.top; r <= b.bot; r++) {
      if (L.top[r] == null) continue;
      var part = inBand(P.y, P.y + P.h, bandSpan(L, r, 4)), y0 = part[0] - P.y, y1 = part[1] - P.y, held = b.occ.indexOf(r) >= 0;
      strips.push({ cls: 'strip ' + (held ? 'occ' : 'gap'), held: held, y: y0 + 6, h: Math.max(4, y1 - y0 - 12) });
    }
  }
  for (var pr in b.pf) partY[pr] = +pr === b.top ? b.body : L.top[+pr] - P.y + 10;
  return { bodyH: b.spans ? P.h : b.h, strips: strips, partY: partY, footY: b.spans ? P.h - 26 : b.h + 10 };
}
// bandSpan: band `r`'s top and bottom in the layout `L`, `inset` in from each: [top, bottom].
export function bandSpan(L, r, inset) {
  return [L.top[r] + inset, L.top[r] + L.rowH[r] - inset];
}
// inBand: the part of the span `lo` to `hi` (a box's, down the drawing) within `band` (bandSpan): [from, to], `to`
// under `from` where they do not meet.
export function inBand(lo, hi, band) {
  return [Math.max(lo, band[0]), Math.min(hi, band[1])];
}
// arrowGeom: an arrow's two ends between two placed boxes, `arrow` naming the boxes (from, to) and the bands it leaves
// and enters (rf, rt): straight down or up where the boxes share columns, else sideways at its two bands. ka and kb name
// the side of the box each end sits on.
export function arrowGeom(arrow, L) {
  var A = L.P[arrow.from], B = L.P[arrow.to], rf = arrow.rf, rt = arrow.rt;
  function ry(box, r) {
    if (L.top[r] == null) return box.y + Math.min(box.h, 60) / 2;
    var part = inBand(box.y + 22, box.y + box.h - 14, bandSpan(L, r, 8));
    return part[1] < part[0] ? box.y + box.h / 2 : (part[0] + part[1]) / 2;
  }
  if (Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 20) {
    var down = B.y > A.y;
    return { vert: true, x1: A.x + A.w / 2, x2: B.x + B.w / 2, y1: down ? A.y + A.H : A.y, y2: down ? B.y : B.y + B.H, ka: arrow.from + '\nB' + (down ? 'B' : 'T'), kb: arrow.to + '\nB' + (down ? 'T' : 'B'), span: Math.min(A.w, B.w) * .6 };
  }
  var right = B.x > A.x;
  return { vert: false, x1: right ? A.x + A.w : A.x, x2: right ? B.x : B.x + B.w, y1: ry(A, rf), y2: ry(B, rt), ka: arrow.from + '\n' + (right ? 'R' : 'L') + rf, kb: arrow.to + '\n' + (right ? 'L' : 'R') + rt, span: Math.min(L.rowH[rf] || 60, L.rowH[rt] || 60) * .55 };
}
// arrowCurves: arrows between placed boxes drawn as curves from box to box, each one's path; ends sharing one side of
// one box in one band spread apart.
export function arrowCurves(arrows, L) {
  var gs = arrows.map(function (p) { return arrowGeom(p, L); }), ends = Object.create(null);
  gs.forEach(function (g) { [[g.ka, g, 'a'], [g.kb, g, 'b']].forEach(function (z) { (ends[z[0]] = ends[z[0]] || []).push(z); }); });
  function spread(lst) {
    var span = Math.min(lst[0][1].span, 14 * lst.length);
    lst.forEach(function (z, k) {
      var g = z[1], d = -span / 2 + span * (k + .5) / lst.length;
      if (g.vert) { if (z[2] === 'a') g.x1 += d; else g.x2 += d; } else if (z[2] === 'a') g.y1 += d; else g.y2 += d;
    });
  }
  for (var key in ends) if (ends[key].length > 1) spread(ends[key]);
  return gs.map(function (g) {
    var c = curvePoints(g);
    function point(p) { return p[0] + ',' + p[1]; }
    return 'M' + point(c[0]) + ' C' + point(c[1]) + ' ' + point(c[2]) + ' ' + point(c[3]);
  });
}
// relationStraight: a declared relation drawn as a straight line between its two placed boxes, `line` naming
// them (from, to) and their top bands (rf, rt).
export function relationStraight(line, L) {
  var g = arrowGeom(line, L);
  return 'M' + g.x1 + ',' + g.y1 + ' L' + g.x2 + ',' + g.y2;
}
// curvePoints: the four points of an arrow's curve, as its path draws them.
export function curvePoints(g) {
  if (g.vert) { var c = Math.max(30, Math.abs(g.y2 - g.y1) * .45) * (g.y2 > g.y1 ? 1 : -1); return [[g.x1, g.y1], [g.x1, g.y1 + c], [g.x2, g.y2 - c], [g.x2, g.y2]]; }
  var cx = Math.max(40, Math.abs(g.x2 - g.x1) * .4) * (g.x2 > g.x1 ? 1 : -1);
  return [[g.x1, g.y1], [g.x1 + cx, g.y1], [g.x2 - cx, g.y2], [g.x2, g.y2]];
}
// relationMarker: a declared relation's marker — a diamond at the start for an aggregation or a composition, an open
// head at the end otherwise.
export function relationMarker(r) {
  var id = 'open';
  if (r.k === 'aggregation') id = 'dia'; else if (r.k === 'composition') id = 'diaf';
  return { at: id === 'open' ? 'marker-end' : 'marker-start', url: 'url(#sv-' + id + '-rel)' };
}
// arrowLook: how an arrow draws — its path's classes by its mark and its first kind, its head's marker, and its width,
// growing with its file edges.
export function arrowLook(p, kinds) {
  var k = kinds[Object.keys(p.kinds).map(Number)[0]] || 'dependency', head = 'open', dash = '', cls = markClass(p.mark);
  if (k === 'implements' || k === 'inheritance') head = 'tri';
  if (k === 'type-only') dash = ' type'; else if (k === 'implements') dash = ' impl';
  return { edge: 'edge' + cls + dash, marker: 'url(#sv-' + head + cls.replace(' ', '-') + ')', width: String(Math.min(1.2 + Math.log(p.n) / Math.LN2 * 0.8, 6)) };
}
