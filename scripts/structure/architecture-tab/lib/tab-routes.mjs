// @level presentation
// Roadkeeper — the Architecture drawing's routes, a part of its one embedded entry (tabDrawing, tab-drawing.mjs): each arrow
// and declared relation between a view's placed boxes drawn as right-angle lines in the gaps between the boxes, its
// corners rounded, by a cheapest path on a grid that every box blocks. Where no path is found, or the draw's search
// steps run out, an arrow is drawn as a curve from box to box, spread where curves share a box's side, and a relation as
// a straight line (tab-layout.mjs). Pure.
//
// The page embeds each function here by its own source, in one scope with the entry's and the geometry's.

import { arrowCurves, bandSpan, inBand, relationStraight } from "./tab-layout.mjs";

// routeRules: the routing's numbers, each in px or in steps of the path's cost.
export function routeRules() {
  return {
    // a path runs on cell centres this far apart, fine enough that the narrowest gap the layout leaves between two
    // boxes holds two lines
    cell: 8,
    // a box blocks the cells within this much of its edges, so no line touches it
    margin: 4,
    // a turn costs six steps more, so a path turns only to save more than that
    bend: 6,
    // each line already in a cell costs three steps more, so the lines spread through the gaps
    share: 3,
    // an end sits at least this far in from its side's corners, so no line leaves or enters at a corner
    inset: 14,
    // the ends on one box sit at least this far apart where its sides have room
    apart: 16,
    // a corner rounds over one cell: its curve cuts in by a quarter of that on each axis, 2 px, less than the margin, so
    // a rounded corner never touches a box
    round: 8,
    // the lanes the grid holds left of the leftmost boxes: lines pass left of them there, and never cross the bands'
    // names further left
    leftLanes: 2,
    // the search steps one draw may take across its lines, counted in steps, never in time, so a drawing always draws
    // the same lines; the lines past it draw the fallback. A 100-box, 200-arrow drawing routes every line in about 1 s;
    // the 400-box cap answers in about 1.2 s; Roadkeeper's own drawing takes at most about 125 thousand (its top view)
    steps: 4000000,
  };
}
// viewRoutes: a view's routes, { layout, paths }, for its `lines` in its layout `L`: `last`, the view's last routes,
// where they were for the same layout (routedLayout), so a redraw that moves no box, the fonts' when they change no
// width, routes nothing; else its lines routed (routedLines).
export function viewRoutes(last, lines, L) {
  var layout = routedLayout(L);
  return last && last.layout === layout ? last : { layout: layout, paths: routedLines(lines, L) };
}
// routedLayout: what the routing reads of the layout `L`, as one string: the drawing's size, the bands, and each placed
// box's place, size and chip row's end.
export function routedLayout(L) {
  var parts = [L.width, L.height, L.top.join(), L.rowH.join()];
  for (var id in L.P) { var P = L.P[id]; parts.push(id, P.x, P.y, P.w, P.h, P.H, P.b.row.end); }
  return parts.join('\n');
}
// routedLines: lines between the placed boxes of the layout `L`, each { from, to, rf, rt, rel }, the boxes and the bands
// it leaves and enters, and whether it is a declared relation: each one's path, routed around the boxes; where no route
// is found or the draw's steps ran out, an arrow's curve from box to box, spread where curves share a box's side
// (arrowCurves), a relation's straight line (relationStraight); null where a box is not placed. All are routed
// together, once a draw, in order: each line pays for the cells the earlier ones take, and the ends on one box keep
// apart.
export function routedLines(lines, L) {
  var grid = routeGrid(L, routeRules()), paths = [], unrouted = [];
  lines.forEach(function (line, k) {
    var placed = L.P[line.from] && L.P[line.to], corners = placed ? routedLine(grid, line) : null;
    paths.push(corners ? roundedPath(corners, grid.rules.round) : null);
    if (placed && !corners) unrouted.push(k);
  });
  var arrows = unrouted.filter(function (k) { return !lines[k].rel; }), curves = arrowCurves(arrows.map(function (k) { return lines[k]; }), L);
  arrows.forEach(function (k, n) { paths[k] = curves[n]; });
  unrouted.forEach(function (k) { if (lines[k].rel) paths[k] = relationStraight(lines[k], L); });
  return paths;
}
// routeGrid: the grid lines are routed on, over the layout `L` by the `rules`: W by H cells from x0, its first cell's
// centre `rules.leftLanes` cells left of the boxes (L.left); whether a box blocks each cell (blocked); how many lines
// take each cell (used); each box's blocked cells, a range (range: the cells [i0, i1, j0, j1]); the ports each box's
// ends take (taken); the search every line reuses, each state's cost and previous state, its heap and the states it
// wrote, each cell's goal way and the range of its goal ports (aim); and the draw's search steps left (stepsLeft). It reaches past the drawing's right edge as far as a gap
// between two columns (L.gx), so the lines around the rightmost boxes spread there as between two columns; and past its
// bottom as far as a band's padding (L.pad), so under the lowest boxes, with the band's own padding, they have the room
// between two bands' boxes.
export function routeGrid(L, rules) {
  var x0 = L.left - (rules.leftLanes + 0.5) * rules.cell, W = Math.ceil((L.width + L.gx - x0) / rules.cell), H = Math.ceil((L.height + L.pad) / rules.cell);
  var grid = { L: L, rules: rules, x0: x0, W: W, H: H, blocked: new Uint8Array(W * H), used: new Uint16Array(W * H), range: Object.create(null), taken: Object.create(null), stepsLeft: rules.steps };
  grid.search = { cost: new Float64Array(W * H * 4).fill(Infinity), unreached: Infinity, prev: new Int32Array(W * H * 4).fill(-1), heap: [], touched: [], goal: new Int8Array(W * H).fill(-1), aim: null };
  Object.keys(L.P).forEach(function (id) { blockBox(grid, id); });
  return grid;
}
// blockBox: the cells within the margin of box `id` blocked on the grid.
export function blockBox(grid, id) {
  var P = grid.L.P[id], r = grid.rules, half = r.cell / 2;
  var i0 = Math.max(0, Math.ceil((P.x - r.margin - grid.x0 - half) / r.cell)), i1 = Math.min(grid.W - 1, Math.floor((P.x + P.w + r.margin - grid.x0 - half) / r.cell));
  var j0 = Math.max(0, Math.ceil((P.y - r.margin - half) / r.cell)), j1 = Math.min(grid.H - 1, Math.floor((P.y + P.H + r.margin - half) / r.cell));
  grid.range[id] = [i0, i1, j0, j1];
  for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) grid.blocked[cellAt(grid, i, j)] = 1;
}
// cellAt: cell i, j's index on the grid, row by row.
export function cellAt(grid, i, j) {
  return j * grid.W + i;
}
// cellColumn, cellRow: the i and the j of the cell at index `c`.
export function cellColumn(grid, c) {
  return c % grid.W;
}
export function cellRow(grid, c) {
  return (c - c % grid.W) / grid.W;
}
// stateOf: a search state, one number: the cell at index `c` and the way the path entered it (0 right, 1 left, 2 down,
// 3 up).
export function stateOf(c, way) {
  return c * 4 + way;
}
// stateCell, stateWay: a state's cell index and its way, read back.
export function stateCell(s) {
  return s >> 2;
}
export function stateWay(s) {
  return s & 3;
}
// cellX, cellY: a cell's centre.
export function cellX(grid, i) {
  return grid.x0 + i * grid.rules.cell + grid.rules.cell / 2;
}
export function cellY(grid, j) {
  return j * grid.rules.cell + grid.rules.cell / 2;
}
// routedLine: line `line` routed on the grid, its path found (linePath) and kept there (pathKept): its corners, from its
// end on box `from` to its end on box `to`, each end on its box's side. Null where no path is found.
export function routedLine(grid, line) {
  var path = linePath(grid, line);
  if (!path) return null;
  pathKept(grid, line, path);
  var points = [endPoint(grid, line.from, path.first)];
  path.states.forEach(function (s) { var c = stateCell(s); points.push([cellX(grid, cellColumn(grid, c)), cellY(grid, cellRow(grid, c))]); });
  points.push(endPoint(grid, line.to, path.last));
  return cornersOf(points);
}
// linePath: the cheapest path for line `line` between the ports its two ends may take (cheapestPath): its states, the
// port it leaves at (first) and the one it enters at (last); null where none is found.
export function linePath(grid, line) {
  var src = endPorts(grid, { id: line.from, band: line.rf }), dst = endPorts(grid, { id: line.to, band: line.rt });
  var states = cheapestPath(grid, src, dst);
  if (!states) return null;
  var head = states[0], tail = states[states.length - 1];
  return {
    states: states,
    first: src.filter(function (p) { return stateOf(cellAt(grid, p[0], p[1]), p[2]) === head; })[0],
    last: dst.filter(function (p) { return stateOf(cellAt(grid, p[0], p[1]), p[2] ^ 1) === tail; })[0],
  };
}
// pathKept: line `line`'s path (linePath) kept on the grid: each cell it takes counted (used), its two ports kept on
// their boxes (taken), so the lines routed after it pay for its cells and keep their ends apart from its.
export function pathKept(grid, line, path) {
  path.states.forEach(function (s) { grid.used[stateCell(s)]++; });
  (grid.taken[line.from] = grid.taken[line.from] || []).push(path.first);
  (grid.taken[line.to] = grid.taken[line.to] || []).push(path.last);
}
// endPorts: the ports an end may take on box `end.id` in band `end.band`, each [i, j, way out of the box: 0 right, 1
// left, 2 down, 3 up]: apart from the box's ends taken where its sides have room, else any.
export function endPorts(grid, end) {
  var apart = portCells(grid, end, grid.rules.apart);
  return apart.length ? apart : portCells(grid, end, 0);
}
// portCells: the cells just outside box `end.id`'s blocked cells, on the sides its band allows (sidesOf), each along
// its side at least the inset in from the side's corners, free with a free cell beyond (portFree), and at least `gap`
// from the box's ends taken (portApart).
export function portCells(grid, end, gap) {
  var r = grid.range[end.id], sides = sidesOf(grid, grid.L.P[end.id], end.band), taken = grid.taken[end.id] || [], cells = gap / grid.rules.cell, out = [];
  function add(i, j, way) { var port = [i, j, way]; if (portFree(grid, port) && portApart(port, taken, cells)) out.push(port); }
  function x(i) { return cellX(grid, i); }
  function y(j) { return cellY(grid, j); }
  alongSide(sides.rows, y, function (j) { add(r[1] + 1, j, 0); add(r[0] - 1, j, 1); });
  if (sides.top) alongSide(sides.cols, x, function (i) { add(i, r[2] - 1, 3); });
  if (sides.bottom) alongSide(sides.under, x, function (i) { add(i, r[3] + 1, 2); });
  return out;
}
// sidesOf: where an end on the placed box `P` may sit, on its card (h), never beside or under the chip row hanging
// below a one-band card: along its left and right sides (rows), along its top (cols) and along its bottom right of the
// chip row (under), each as alongSide reads it (insetSide); and whether its top and its bottom take ends — its bottom
// only with room right of the chips. A box spanning bands takes an end only within band `band`: its sides there, its
// top only in its first band and its bottom only in its last.
export function sidesOf(grid, P, band) {
  var b = P.b, r = grid.range[b.id], half = grid.rules.cell / 2, inset = grid.rules.inset, chips = b.spans ? 0 : b.row.end;
  var rows = { lo: r[2], hi: r[3], from: P.y, to: P.y + P.h }, under = { lo: r[0], hi: r[1], from: P.x + chips, to: P.x + P.w };
  var top = true, bottom = under.to - under.from >= 2 * inset + grid.rules.cell;
  if (b.spans && grid.L.top[band] != null) {
    var edges = bandSpan(grid.L, band, 0), part = inBand(P.y, P.y + P.h, edges);
    rows = { lo: Math.max(r[2], Math.ceil((edges[0] - half) / grid.rules.cell)), hi: Math.min(r[3], Math.floor((edges[1] - half) / grid.rules.cell)), from: part[0], to: part[1] };
    top = band === b.top; bottom = band === b.bot;
  }
  return { rows: insetSide(rows, inset), cols: insetSide({ lo: r[0], hi: r[1], from: P.x, to: P.x + P.w }, inset), under: insetSide(under, inset), top: top, bottom: bottom };
}
// insetSide: a side, its cells `side.lo` to `side.hi` along its corners `side.from` and `side.to`, as alongSide reads it:
// its cells, the span an end may sit in, `inset` in from the corners (from, to), and the side's middle (mid).
export function insetSide(side, inset) {
  return { lo: side.lo, hi: side.hi, from: side.from + inset, to: side.to - inset, mid: (side.from + side.to) / 2 };
}
// alongSide: each cell of a side (insetSide), `side.lo` to `side.hi`, whose centre, `at(k)`, lies within the span an end
// may sit in; where none does, the one nearest the side's middle.
export function alongSide(side, at, each) {
  var hit = false, best = side.lo;
  for (var k = side.lo; k <= side.hi; k++) {
    var centre = at(k);
    if (centre >= side.from && centre <= side.to) { each(k); hit = true; }
    if (Math.abs(centre - side.mid) < Math.abs(at(best) - side.mid)) best = k;
  }
  if (!hit && side.lo <= side.hi) each(best);
}
// portFree: whether `port` ([i, j, way]) and the cell beyond it, the way out of its box, are free, so a line can come
// straight in as well as leave.
export function portFree(grid, port) {
  var i = port[0], j = port[1], beyond = wayStep(port[2]);
  return cellFree(grid, i, j) && cellFree(grid, i + beyond[0], j + beyond[1]);
}
// portApart: whether `port` lies at least `cells` cells from each of the box's ends taken, `ends`, measured along the
// grid.
export function portApart(port, ends, cells) {
  return ends.every(function (t) { return Math.abs(t[0] - port[0]) + Math.abs(t[1] - port[1]) >= cells; });
}
// wayStep: a step's move in cells, [di, dj], by its way: 0 right, 1 left, 2 down, 3 up.
export function wayStep(way) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]][way];
}
// cellFree: whether cell i, j is on the grid and blocked by no box.
export function cellFree(grid, i, j) {
  var onGrid = i >= 0 && i < grid.W && j >= 0 && j < grid.H;
  return onGrid && !grid.blocked[cellAt(grid, i, j)];
}
// endPoint: where a line's end meets box `id`'s card, at its port: a bottom end at the card's bottom, past the chip row.
export function endPoint(grid, id, port) {
  var P = grid.L.P[id], way = port[2];
  if (way === 0) return [P.x + P.w, cellY(grid, port[1])];
  if (way === 1) return [P.x, cellY(grid, port[1])];
  if (way === 2) return [cellX(grid, port[0]), P.y + P.h];
  return [cellX(grid, port[0]), P.y];
}
// cheapestPath: the cheapest path on the grid from a port in `src` to one in `dst`, leaving the one box and entering
// the other: a step costs 1, a turn rules.bend more, and a cell rules.share more for each line already in it. Searched
// cheapest estimate first (A*), the estimate never over the true cost, so the path found is the cheapest; each state
// taken off the heap spends one of the draw's steps (grid.stepsLeft). Its states (stateOf), first to last; null where
// no path reaches, or the draw's steps run out first.
export function cheapestPath(grid, src, dst) {
  var search = grid.search, path = null;
  if (!src.length || !dst.length) return null;
  search.aim = rangeOf(dst);
  dst.forEach(function (p) { search.goal[cellAt(grid, p[0], p[1])] = p[2]; });
  // a start keeps no previous state: -1, as the search left it
  src.forEach(function (p) { var c = cellAt(grid, p[0], p[1]); reached(grid, stateOf(c, p[2]), grid.used[c] * grid.rules.share); });
  while (search.heap.length && grid.stepsLeft > 0) {
    var top = heapPop(search.heap), s = top[1];
    if (top[0] > rank(search.cost[s], estimate(grid, s))) continue;
    grid.stepsLeft--;
    if (search.goal[stateCell(s)] === (stateWay(s) ^ 1)) { path = pathBack(search.prev, s); break; }
    stepsFrom(grid, s);
  }
  searchCleared(grid, dst);
  return path;
}
// rangeOf: the range of cells, [i0, i1, j0, j1], holding every port in `ports`.
export function rangeOf(ports) {
  var is = ports.map(function (p) { return p[0]; }), js = ports.map(function (p) { return p[1]; });
  return [Math.min.apply(null, is), Math.max.apply(null, is), Math.min.apply(null, js), Math.max.apply(null, js)];
}
// estimate: from state `s` to the nearest cell of the search's aim, the range holding its goal ports, the steps and the
// turns no path can do without: at most the path's cost from there, as each step costs at least 1 and moves one cell,
// and each turn costs rules.bend. A path needs a turn to move on both axes, and two to go back against its way.
export function estimate(grid, s) {
  var aim = grid.search.aim, c = stateCell(s), way = stateWay(s), i = cellColumn(grid, c), j = cellRow(grid, c);
  // how far the cell has gone past the aim each way, in the order of the ways: right of it, left, below, above
  var past = [i - aim[1], aim[0] - i, j - aim[3], aim[2] - j];
  var dx = beyond(past[0], past[1]), dy = beyond(past[2], past[3]);
  var turns = (way < 2 ? dy : dx) > 0 ? 1 : 0;
  if (past[way] > 0) turns = 2;
  return dx + dy + turns * grid.rules.bend;
}
// beyond: how far a cell lies outside the aim on one axis, given how far it has gone past each of its two edges, at
// most one of them above 0. Plain comparisons, no Math: a search reads it at every state, and a global read inside a
// suite's vm context costs several times a local one.
export function beyond(past, pastOther) {
  if (past > 0) return past;
  return pastOther > 0 ? pastOther : 0;
}
// rank: a state's place on the heap by its cost so far and its estimate: the least total first, and among equal totals
// the one nearest its aim, so the search follows one cheapest path rather than every path as cheap. A cost and an
// estimate are whole steps; an estimate's millionth stays under one step.
export function rank(cost, estimated) {
  return cost + estimated + estimated / 1e6;
}
// reached: state `s` reached at `cost`, kept where it is cheaper than before; whether it was kept, so the step that
// reached it keeps itself as its previous.
export function reached(grid, s, cost) {
  var search = grid.search;
  if (cost >= search.cost[s]) return false;
  if (search.cost[s] === search.unreached) search.touched.push(s);
  search.cost[s] = cost; heapPush(search.heap, [rank(cost, estimate(grid, s)), s]);
  return true;
}
// searchCleared: the search's costs, links, heap and goal cleared where this search wrote them, for the next line.
export function searchCleared(grid, dst) {
  var search = grid.search;
  search.touched.forEach(function (s) { search.cost[s] = search.unreached; search.prev[s] = -1; });
  search.touched.length = 0; search.heap.length = 0;
  dst.forEach(function (p) { search.goal[cellAt(grid, p[0], p[1])] = -1; });
}
// stepsFrom: each step from state `s` to a free neighbouring cell, never straight back, costed into the search.
export function stepsFrom(grid, s) {
  var c = stateCell(s), way = stateWay(s), i = cellColumn(grid, c), j = cellRow(grid, c);
  for (var next = 0; next < 4; next++) {
    var step = wayStep(next), ni = i + step[0], nj = j + step[1], nc = cellAt(grid, ni, nj), ns = stateOf(nc, next);
    if (next === (way ^ 1) || !cellFree(grid, ni, nj)) continue;
    if (reached(grid, ns, grid.search.cost[s] + 1 + (next !== way ? grid.rules.bend : 0) + grid.used[nc] * grid.rules.share)) grid.search.prev[ns] = s;
  }
}
// pathBack: the states from a path's first to state `last`, by each one's previous.
export function pathBack(prev, last) {
  var states = [];
  for (var s = last; s >= 0; s = prev[s]) states.push(s);
  return states.reverse();
}
// heapPush, heapPop: a heap of [cost, state], its cheapest on top.
export function heapPush(heap, item) {
  heap.push(item);
  for (var k = heap.length - 1; k > 0;) {
    var up = (k - 1) >> 1;
    if (heap[up][0] <= heap[k][0]) break;
    var t = heap[up]; heap[up] = heap[k]; heap[k] = t; k = up;
  }
}
export function heapPop(heap) {
  var top = heap[0], last = heap.pop();
  if (!heap.length) return top;
  heap[0] = last;
  for (var k = 0; ;) {
    var l = 2 * k + 1, m = k;
    if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
    if (l + 1 < heap.length && heap[l + 1][0] < heap[m][0]) m = l + 1;
    if (m === k) return top;
    var t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
  }
}
// cornersOf: a path's points kept where it turns, and its two ends.
export function cornersOf(points) {
  var out = [points[0]];
  for (var k = 1; k < points.length - 1; k++) {
    var p = points[k - 1], q = points[k], n = points[k + 1];
    if ((q[0] - p[0]) * (n[1] - q[1]) !== (q[1] - p[1]) * (n[0] - q[0])) out.push(q);
  }
  out.push(points[points.length - 1]);
  return out;
}
// roundedPath: a right-angle path through `corners`, each corner rounded at `radius`, or less where a leg is short.
export function roundedPath(corners, radius) {
  var d = 'M' + corners[0][0] + ',' + corners[0][1];
  for (var k = 1; k < corners.length - 1; k++) {
    var p = corners[k - 1], q = corners[k], n = corners[k + 1], l1 = Math.hypot(q[0] - p[0], q[1] - p[1]), l2 = Math.hypot(n[0] - q[0], n[1] - q[1]);
    var r = Math.min(radius, l1 / 2, l2 / 2), a = [q[0] - (q[0] - p[0]) / l1 * r, q[1] - (q[1] - p[1]) / l1 * r], b = [q[0] + (n[0] - q[0]) / l2 * r, q[1] + (n[1] - q[1]) / l2 * r];
    d += ' L' + a[0] + ',' + a[1] + ' Q' + q[0] + ',' + q[1] + ' ' + b[0] + ',' + b[1];
  }
  var end = corners[corners.length - 1];
  return d + ' L' + end[0] + ',' + end[1];
}
