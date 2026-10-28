// @level presentation
// Roadkeeper — the Architecture drawing's counting, a part of its one embedded entry (tabDrawing, tab-drawing.mjs): given the
// view's data (tabData, tab-data.mjs), drawingOf decodes its edges and builds the tree, the bands and what each view and
// node adds up to. The tab's HTML part (architecture-tab.mjs) takes its totals from drawingTotals. Pure.
//
// The page embeds each function here by its own source, in one scope with the other parts' and the originals they
// call (architecture-tab.mjs, ORIGINALS).

import { reviewPointKind, reviewPointOrder } from "../../lib/structure-model.mjs";
import { drawsRed, MARK, outwardFirst } from "./tab-data.mjs";

// earliestReviewPoints: the points held so far ({ day, version }, or null for none) with `p` added: the earliest of each
// kind, kept apart.
export function earliestReviewPoints(held, p) {
  var day = held ? held.day : null, version = held ? held.version : null;
  if (reviewPointKind(p) === 'day') { if (day === null || reviewPointOrder(p, day) < 0) day = p; }
  else if (version === null || reviewPointOrder(p, version) < 0) version = p;
  return { day: day, version: version };
}
// heldTogether: two sets of held points (earliestReviewPoints') as one, the earliest of each kind.
export function heldTogether(held, more) {
  if (!more) return held;
  [more.day, more.version].forEach(function (p) { if (p !== null) held = earliestReviewPoints(held, p); });
  return held;
}
// The counting: an edge reaches it decoded by drawingOf, its fields by name.
//
// levelRows: each level's band, by its index in the rings read innermost first; band 0 is the outermost ring, and a
// file with no level sits in the band past the last, rings.length.
export function levelRows(rings) {
  var rows = [];
  for (var r = 0; r < rings.length; r++) for (var j = 0; j < rings[r].length; j++) rows.push(rings.length - 1 - r);
  return rows;
}
// treeOf: modules, their files, and the files no module holds, from the view's modules, decoded edges and `loose`: a
// nested module hangs under its parent, a file under the module the reader resolved for it, each named by its path from
// that module (`lib/rulings.mjs`), a file no module holds at the top, named by its path. A folder that is no module has
// no interface, so it is no node. Each node carries its levels: a module its span, a file its own. FL is each file's
// level: an edge's end says it first, then the module's override, else its default; a file no module holds, its own.
export function treeOf(modules, edges, loose) {
  var N = Object.create(null), kids = Object.create(null), FL = Object.create(null);
  function node(id, kind, label, parent) {
    if (N[id]) return N[id];
    N[id] = { id: id, kind: kind, label: label, parent: parent, lv: [] };
    var k = parent == null ? '' : parent;
    (kids[k] = kids[k] || []).push(id);
    return N[id];
  }
  function place(f, m, l) {
    if (m == null || f.indexOf(m + '/') !== 0) return;
    if (l != null && !(f in FL)) FL[f] = l;
    node(f, 'file', f.slice(m.length + 1), m);
  }
  modules.slice().sort(function (a, b) { return a.p.length - b.p.length; }).forEach(function (m) {
    node(m.p, 'mod', m.parent ? m.p.slice(m.parent.length + 1) : m.p, m.parent).lv = m.lv.slice();
  });
  edges.forEach(function (e) {
    var a = modules[e.fromModule], b = modules[e.toModule];
    place(e.from, a && a.p, e.fromLevel); place(e.to, b && b.p, e.toLevel);
  });
  modules.forEach(function (m) {
    var own = Object.create(null);
    m.lf.forEach(function (x) { own[x[0]] = x[1]; });
    (m.files || []).concat(m.rootFiles).forEach(function (f) { place(f, m.p, f in own ? own[f] : m.l); });
  });
  loose.forEach(function (x) { if (!N[x[0]]) { node(x[0], 'file', x[0], null); FL[x[0]] = x[1]; } });
  for (var id in N) {
    var n = N[id];
    if (n.kind !== 'file') continue;
    var l = id in FL ? FL[id] : -1;
    n.lv = l >= 0 ? [l] : [];
  }
  for (var k in kids) kids[k].sort(function (a, b) { return nodeOrder(N[a], N[b]); });
  return { N: N, kids: kids, FL: FL };
}
// mixedSpans: the tree with each file of mixed levels ([file, levels, mark, until]) spanning its levels.
export function mixedSpans(T, mixed) {
  mixed.forEach(function (x) {
    var n = T.N[x[0]];
    if (n && n.kind === 'file') n.lv = x[1].slice();
  });
  return T;
}
// mixedOf: the view's files of mixed levels by file, each with its mark and its exception's review point.
export function mixedOf(V) {
  var out = Object.create(null);
  (V.mixed || []).forEach(function (x) { out[x[0]] = { mark: x[2], until: x[3] }; });
  return out;
}
// nodeOrder: the order of a view's nodes — modules, then files, each kind by label.
export function nodeOrder(x, y) {
  var kind = { mod: 0, file: 1 };
  return kind[x.kind] - kind[y.kind] || (x.label > y.label) - (x.label < y.label);
}
// childIn: the child of `view` (null: the top) that holds node `id`, or null when `view` does not hold it.
export function childIn(T, view, id) {
  var want = view == null ? null : view;
  for (var v = id; v != null && T.N[v]; v = T.N[v].parent) if ((T.N[v].parent == null ? null : T.N[v].parent) === want) return v;
  return null;
}
// outsideIn: what names node `id` from inside `view` — the node just below the deepest one holding both.
export function outsideIn(T, view, id) {
  var anc = Object.create(null);
  for (var v = view; v != null && T.N[v]; v = T.N[v].parent) anc[v] = 1;
  for (var u = id; u != null && T.N[u]; u = T.N[u].parent) { var p = T.N[u].parent; if (p == null || anc[p]) return u; }
  return null;
}
// blankTally: a count with no file edge in it yet.
export function blankTally() {
  return { n: 0, out: 0, exc: 0, earliest: null };
}
// tallyEdge: one file edge added to a count { n, out, exc, earliest } — every edge, the outward ones (a due exception's
// among them), the excepted ones and the earliest review point of each kind among them.
export function tallyEdge(x, e) {
  x.n += e.n;
  if (drawsRed(e.mark)) x.out += e.n;
  if (e.mark === MARK.excepted) { x.exc += e.n; if (e.until) x.earliest = earliestReviewPoints(x.earliest, e.until); }
  return x;
}
// aggregateView: one view's arrows, what hides inside each box and what leaves the view. Every count is of file edges,
// each marked file to file; an arrow is red when any edge in it is outward and uncovered, orange when every outward one
// is excepted — with the earliest review point among them — and grey otherwise. It leaves at the band where most of
// its file edges start and enters where most end, counting only the outward ones when it has any.
export function aggregateView(edges, childOf, outsideOf, rowOf) {
  var pairs = Object.create(null), list = [], inside = Object.create(null), outs = Object.create(null);
  for (var i = 0; i < edges.length; i++) {
    var e = edges[i], ca = childOf(e.from), cb = childOf(e.to);
    if (ca == null) continue;
    if (cb == null) {
      var t = outsideOf(e.to);
      if (t == null) continue;
      var o = outs[ca] || (outs[ca] = Object.create(null));
      tallyEdge(o[t] || (o[t] = blankTally()), e);
      continue;
    }
    if (ca === cb) { tallyEdge(inside[ca] || (inside[ca] = blankTally()), e); continue; }
    var key = ca + '\n' + cb, p = pairs[key];
    if (!p) {
      p = pairs[key] = Object.assign(blankTally(), { from: ca, to: cb, kinds: Object.create(null), rr: Object.create(null), rm: Object.create(null), edges: [] });
      list.push(p);
    }
    tallyEdge(p, e); p.kinds[e.kind] = 1; p.edges.push(e);
    var rk = rowOf(e.fromLevel) + '>' + rowOf(e.toLevel);
    p.rr[rk] = (p.rr[rk] || 0) + e.n;
    if (e.mark) p.rm[rk] = (p.rm[rk] || 0) + e.n;
  }
  for (var j = 0; j < list.length; j++) {
    var q = list[j], src = q.out || q.exc ? q.rm : q.rr, best = null, bn = -1;
    q.mark = tallyMark(q);
    for (var k in src) if (src[k] > bn) { bn = src[k]; best = k; }
    var ends = best.split('>'); q.rf = +ends[0]; q.rt = +ends[1];
  }
  for (var c in outs) for (var d in outs[c]) outs[c][d].mark = tallyMark(outs[c][d]);
  return { pairs: list, inside: inside, outs: outs };
}
// tallyMark: a tally's mark, as an arrow's or a chip's — red, outward, when any edge in it is outward and uncovered;
// orange, excepted, when every outward one is excepted; grey, inward, when none is outward.
export function tallyMark(x) {
  if (x.out) return MARK.outward;
  return x.exc ? MARK.excepted : MARK.inward;
}
// viewTotals: a view's count line — its arrows and their file edges, the red and the orange arrows, and the outward and
// excepted file edges between its boxes and hidden inside them.
export function viewTotals(agg) {
  var t = { arrows: agg.pairs.length, n: 0, out: 0, exc: 0, red: 0, orange: 0, insideOut: 0, insideExc: 0 };
  for (var i = 0; i < agg.pairs.length; i++) {
    var p = agg.pairs[i];
    t.n += p.n; t.out += p.out; t.exc += p.exc;
    if (p.mark === MARK.outward) t.red++;
    if (p.mark === MARK.excepted) t.orange++;
  }
  for (var k in agg.inside) { t.insideOut += agg.inside[k].out; t.insideExc += agg.inside[k].exc; }
  return t;
}
// nodeEdges: a node's detail — what it depends on outside it, by what names each target from inside it, counted as an
// arrow is; what uses it from outside, by what names each user; the marked file edges with both ends inside it; and the
// file edges ending in it and starting in it, counted.
export function nodeEdges(edges, id, outsideOf) {
  var deps = Object.create(null), users = Object.create(null), hidden = [], edgesIn = 0, edgesOut = 0;
  function under(f) { return f === id || f.indexOf(id + '/') === 0; }
  for (var i = 0; i < edges.length; i++) {
    var e = edges[i], ia = under(e.from), ib = under(e.to);
    if (ia) edgesOut += e.n;
    if (ib) edgesIn += e.n;
    if (ia && ib) { if (e.mark) hidden.push(e); continue; }
    if (ia) { var t = outsideOf(e.to) || '?'; tallyEdge(deps[t] || (deps[t] = blankTally()), e); }
    if (ib) { var s = outsideOf(e.from) || '?'; users[s] = (users[s] || 0) + e.n; }
  }
  return { deps: deps, users: users, hidden: hidden, edgesIn: edgesIn, edgesOut: edgesOut };
}
// importSteps: inside a module, a band's boxes line up by their own imports, importers first — each node's longest
// import path to the others; without recursion, so a long import chain cannot exhaust the stack; an edge back into the
// path being walked counts as no step, so a cycle ends.
export function importSteps(nodes, arrows) {
  var out = Object.create(null), lvl = Object.create(null), state = Object.create(null);
  nodes.forEach(function (n) { out[n] = []; });
  arrows.forEach(function (e) { if (out[e.from] && out[e.to]) out[e.from].push(e.to); });
  nodes.forEach(function (start) {
    if (state[start]) return;
    var stack = [[start, 0]]; state[start] = 1;
    while (stack.length) {
      var top = stack[stack.length - 1], n = top[0], next = out[n][top[1]++];
      if (next !== undefined) { if (!state[next]) { state[next] = 1; stack.push([next, 0]); } continue; }
      var L = 0; out[n].forEach(function (t) { if (state[t] === 2) L = Math.max(L, lvl[t] + 1); });
      lvl[n] = L; state[n] = 2; stack.pop();
    }
  });
  return lvl;
}
// cardRed: whether a box draws red — it reaches outside the view by an uncovered outward edge, its module's interface is
// skipped into its own files or its inner modules', its module has several root files, or it hides an outward edge.
export function cardRed(chips, m, inside) {
  return chips.some(function (c) { return c.mark === MARK.outward; }) || (m && (m.pastInterface > 0 || innerPastCount(m) > 0 || severalRootFiles(m))) || !!(inside && inside.out);
}
// severalRootFiles: whether more than one source file sits at a module's root.
export function severalRootFiles(m) {
  return m.rootFiles.length > 1;
}
// rootFileCount: how many source files sit at a module's root, the ones over the page cap too.
export function rootFileCount(m) {
  return m.rootFiles.length + m.rootFilesCut;
}
// innerPastCount: how many of a module's inner modules' files are reached past it, the ones over the page cap too.
export function innerPastCount(m) {
  return (m.innerPast ? m.innerPast.length : 0) + (m.innerPastCut || 0);
}
// drawingOf: the drawing, built once from the view's data; the entry reaches views and nodes only through it. It
// decodes the edges by V.fields and builds the tree and the bands: { tree, rows, none, edges, mixed, mods, view, node }.
// - view(id), null for the top: drawingView;
// - node(id): drawingNode.
export function drawingOf(V) {
  var at = Object.create(null), mods = Object.create(null);
  V.fields.forEach(function (f, i) { at[f] = i; });
  var edges = V.edges.map(function (t) { var e = Object.create(null); for (var f in at) e[f] = t[at[f]]; return e; });
  var D = { tree: mixedSpans(treeOf(V.modules, edges, V.loose), V.mixed || []), rows: levelRows(V.rings), none: V.rings.length, edges: edges, mixed: mixedOf(V), mods: mods };
  V.modules.forEach(function (m) { mods[m.p] = m; });
  D.view = function (id) { return drawingView(D, id); };
  D.node = function (id) { return drawingNode(D, id); };
  return D;
}
// rowIn: the band of level `l` in the drawing `D`; no level, the band past the rings.
export function rowIn(D, l) {
  return l >= 0 && D.rows[l] != null ? D.rows[l] : D.none;
}
// boxOf: box `id` of a view (`viewCounts`: its aggregate, agg, and its import steps, steps): its red ruling, its mark
// when its file mixes levels (0 for none), what it hides and its chips — what it reaches outside the view, red first,
// then orange, then the most edges. A box of mixed levels carries its mark: red with no exception or a due one, orange
// excepted.
export function boxOf(D, id, viewCounts) {
  var chips = [], o = viewCounts.agg.outs[id] || Object.create(null), inside = viewCounts.agg.inside[id] || null, mx = D.mixed[id] ? D.mixed[id].mark : 0;
  for (var t in o) chips.push({ t: t, n: o[t].n, mark: o[t].mark, earliest: o[t].earliest });
  chips.sort(function (a, b) { return (b.mark === MARK.outward) - (a.mark === MARK.outward) || (b.mark === MARK.excepted) - (a.mark === MARK.excepted) || b.n - a.n; });
  return { id: id, sub: viewCounts.steps ? -(viewCounts.steps[id] || 0) : 0, chips: chips, inside: inside, mixed: mx, red: cardRed(chips, D.mods[id], inside) || drawsRed(mx) };
}
// drawingView: view `id` of the drawing `D`, null for the top: its boxes in order (boxOf); the arrows, each one's file
// edges outward first; the count line's totals; and how many boxes past the cap are not drawn.
export function drawingView(D, id) {
  // one view draws at most this many boxes and counts the rest
  var MAXCARDS = 400, v = id == null ? null : id, T = D.tree;
  var agg = aggregateView(D.edges, function (f) { return childIn(T, v, f); }, function (f) { return outsideIn(T, v, f); }, function (l) { return rowIn(D, l); });
  var all = T.kids[v == null ? '' : v] || [], children = all.slice(0, MAXCARDS);
  var steps = v == null ? null : importSteps(children, agg.pairs);
  var boxes = children.map(function (c) { return boxOf(D, c, { agg: agg, steps: steps }); });
  boxes.sort(function (a, b) { return a.sub - b.sub || nodeOrder(T.N[a.id], T.N[b.id]); });
  agg.pairs.forEach(function (p) { p.edges.sort(outwardFirst); });
  return { boxes: boxes, arrows: agg.pairs, inside: agg.inside, outs: agg.outs, totals: viewTotals(agg), hidden: Math.max(0, all.length - MAXCARDS) };
}
// drawingTotals: the top view's totals (viewTotals) from the view's data `V`, with `earliest`, the earliest review
// points among the excepted file edges between its boxes and inside them.
export function drawingTotals(V) {
  var top = drawingView(drawingOf(V), null), earliest = null;
  top.arrows.forEach(function (p) { earliest = heldTogether(earliest, p.earliest); });
  for (var k in top.inside) earliest = heldTogether(earliest, top.inside[k].earliest);
  return Object.assign({ earliest: earliest }, top.totals);
}
// mostFirst: the order of a node's lists, most file edges first.
export function mostFirst(a, b) {
  return b.n - a.n;
}
// drawingNode: node `id` of the drawing `D`: what it depends on outside it, each tallied and marked as a chip is, and
// what uses it from outside, each list most file edges first; the marked edges inside it, outward first.
export function drawingNode(D, id) {
  var d = nodeEdges(D.edges, id, function (f) { return outsideIn(D.tree, id, f); }), deps = d.deps, users = d.users;
  return {
    deps: Object.keys(deps).map(function (t) { var o = deps[t]; return { t: t, n: o.n, out: o.out, exc: o.exc, earliest: o.earliest, mark: tallyMark(o) }; }).sort(mostFirst),
    users: Object.keys(users).map(function (t) { return { t: t, n: users[t] }; }).sort(mostFirst),
    hidden: d.hidden.sort(outwardFirst), edgesIn: d.edgesIn, edgesOut: d.edgesOut,
  };
}
