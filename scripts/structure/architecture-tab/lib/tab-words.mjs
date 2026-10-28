// @level presentation
// Roadkeeper — the Architecture drawing's words, a part of its one embedded entry (tabDrawing, tab-drawing.mjs): what the
// boxes, the arrows, the chips and the count line say. The detail beside the drawing is tab-panel.mjs's. Pure.
//
// The page embeds each function here by its own source, in one scope with the other parts' and the originals they
// call (architecture-tab.mjs, ORIGINALS).

import { plural } from "../../../_text.mjs";
import { innerPastCount, mixedOf, rootFileCount, severalRootFiles } from "./tab-counts.mjs";
import { drawsRed, MARK } from "./tab-data.mjs";

// reviewPointWords: the held points as the page says them, the day first: `2026-12-01 · v0.9`; '' for none.
export function reviewPointWords(held) {
  if (!held) return '';
  return [held.day, held.version].filter(function (p) { return p !== null; }).join(' · ');
}
// foldLines: at most `max` lines; when anything is left — lines past the room, or `more` never built — the last line
// says how many, however few.
export function foldLines(lines, more, max) {
  if (!more && lines.length <= max) return lines;
  var shown = Math.min(lines.length, max - 1);
  return lines.slice(0, shown).concat([{ t: "… " + (lines.length - shown + more) + " more", cls: "more" }]);
}
// dependencyWords: `n` dependencies, one file using another counted once a pair and kind, in the page's one word.
export function dependencyWords(n) {
  return plural(n, 'dependency', 'dependencies');
}
// moduleCardLines: a module's interface — its entry's exported names, counted past the room and past what the page
// shipped; with none shipped, its entry file's name, and the names over the cap said.
export function moduleCardLines(entry, pg) {
  var max = pg.look.size.lines, names = [], hidden = entry ? pg.declExCut[entry] || 0 : 0;
  var d = entry ? (pg.decl[entry] || []).filter(function (x) { return x[2]; }) : [];
  for (var j = 0; j < d.length; j++) { if (names.length < max) names.push(declLine(d[j], pg.declKinds)); else hidden++; }
  if (names.length) return foldLines(names, hidden, max);
  var tail = hidden ? [{ t: hidden + " exported names over the page cap", cls: "more" }] : [];
  var file = entry ? [{ t: entry.slice(entry.lastIndexOf("/") + 1), cls: "" }] : [];
  return foldLines(file, 0, max - tail.length).concat(tail);
}
// tallyWords: the tally sentence — a tally's outward and excepted file edges, each after a ' · ', the excepted ones until
// their earliest review point. A box's header, an arrow's tip and a dependency's line say it.
export function tallyWords(x) {
  var w = [];
  if (x.out) w.push({ t: ' · ', cls: '' }, { t: x.out + ' outward', cls: 'bad' });
  if (x.exc) w.push({ t: ' · ', cls: '' }, { t: x.exc + ' ' + exceptedUntil(reviewPointWords(x.earliest)), cls: 'exc' });
  return w;
}
// exceptedUntil: an exception's words — excepted, until its review point when one is said.
export function exceptedUntil(point) {
  return 'excepted' + (point ? ' until ' + point : '');
}
// insideLine: a box's header line for the dependencies it hides — how many, then the tally sentence.
export function insideLine(s) {
  if (!s || !s.n) return [];
  return [{ t: dependencyWords(s.n) + ' inside', cls: '' }].concat(tallyWords(s));
}
// skipNotes: the entry skips a module's card and detail say apart from its gauge — into its inner modules' files,
// covered by an exception not yet due, or a test's — its several root files, and shallow? when its one file is its
// entry; each only when non-zero.
export function skipNotes(m) {
  var inner = innerPastCount(m), notes = [];
  if (inner) notes.push(plural(inner, 'inner module file') + ' past the interface');
  if (m.exceptedPast) notes.push(m.exceptedPast + ' excepted');
  if (m.testsPast) notes.push(plural(m.testsPast, 'test') + ' past the interface');
  if (severalRootFiles(m)) notes.push(rootFileCount(m) + ' root files');
  if (m.shallow) notes.push('shallow?');
  return notes;
}
// skipNote: a card's skipNotes, each after a ' · '.
export function skipNote(m) {
  return skipNotes(m).map(function (t) { return ' · ' + t; }).join('');
}
// cycleLines: for each cycle a module is in, the group and its two-way pairs, each cut said.
export function cycleLines(cy, cycles) {
  var out = [];
  for (var i = 0; i < cy.length; i++) {
    var g = cycles[cy[i]];
    if (!g) continue;
    out.push('a cycle ' + (g.parent == null ? 'among the top modules' : 'in ' + g.parent) + ': ' + g.modules.join(', ') + (g.moreModules ? ' and ' + g.moreModules + ' more' : ''));
    out.push('two-way: ' + (g.pairs.length ? g.pairs.map(function (p) { return p[0] + ' \u21c4 ' + p[1]; }).join(', ') : 'none') + (g.morePairs ? ' and ' + g.morePairs + ' more' : ''));
  }
  return out;
}
// pageOf: what the client's words and boxes read, built once from the view's data `V`, its drawing (`D`, drawingOf) and
// the page's sizes (`look`): the tree, the modules by path, each file's declarations and how many of them, and of its
// exported ones, were cut, and the level names in index order.
export function pageOf(V, D, look) {
  var mods = Object.create(null), decl = Object.create(null), declCut = Object.create(null), declExCut = Object.create(null), names = [], mixed = mixedOf(V);
  V.modules.forEach(function (m) { mods[m.p] = m; });
  V.decls.forEach(function (d) { decl[d[0]] = d[1]; declCut[d[0]] = d[2] || 0; declExCut[d[0]] = d[3] || 0; });
  V.rings.forEach(function (r) { r.forEach(function (n) { names.push(n); }); });
  return {
    N: D.tree.N, kids: D.tree.kids, rows: D.rows, none: D.none, node: D.node, mods: mods, mixed: mixed, decl: decl, declCut: declCut, declExCut: declExCut,
    names: names, rings: V.rings, kinds: V.kinds, declKinds: V.declKinds, cycles: V.cycles, look: look,
  };
}
// markClass: the class a mark draws in — outward and due red, excepted orange, none for the rest.
export function markClass(mark) {
  if (drawsRed(mark)) return ' bad';
  return mark === MARK.excepted ? ' exc' : '';
}
// declLine: a declaration's line on a card and in the detail — UML's marks, + exported or the minus sign private, as the
// key draws them; a function's parentheses, a type's tag. `kinds` names each declaration kind by its index.
export function declLine(x, kinds) {
  var k = kinds[x[1]];
  return { t: (x[2] ? '+ ' : '\u2212 ') + x[0] + (k === 'fn' ? '()' : '') + (k === 'type' ? ' «type»' : ''), cls: (x[2] ? '' : 'priv') + (k === 'type' ? ' type' : '') };
}
// levelList: a set of levels' names, outermost first as the bands read top to bottom, a ring's peers in its own order,
// or "no level" alone. `lv` indexes the levels of `rings` read innermost first.
export function levelList(lv, rings) {
  if (!lv.length) return ['no level'];
  var out = [], at = 0;
  rings.forEach(function (r) { at += r.length; });
  for (var r = rings.length - 1; r >= 0; r--) {
    at -= rings[r].length;
    for (var j = 0; j < rings[r].length; j++) if (lv.indexOf(at + j) >= 0) out.push(rings[r][j]);
  }
  return out;
}
// levelNames: levelList on one line.
export function levelNames(lv, rings) {
  return levelList(lv, rings).join(', ');
}
// byLevel: an arrow's file edges by the bands they leave and enter, each band by its ring's names.
export function byLevel(rr, rings) {
  var none = rings.length, o = [];
  function name(r) { return r === none ? 'no level' : rings[none - 1 - r].join(' | '); }
  for (var k in rr) { var r = k.split('>'); o.push(name(+r[0]) + ' → ' + name(+r[1]) + ' ' + rr[k]); }
  return o.join(', ');
}
// arrowWords: an arrow's tip lines, the line asking for a click under them (ask), and its panel's note.
export function arrowWords(p, pg) {
  var tally = tallyWords(p).map(function (w) { return w.t; }).join(''), levels = byLevel(p.rr, pg.rings);
  var kinds = Object.keys(p.kinds).map(function (i) { return pg.kinds[+i]; }).join(', ');
  var excepted = p.exc ? ', ' + p.exc + ' outward but ' + exceptedUntil(reviewPointWords(p.earliest)) : '';
  return {
    tip: [pg.N[p.from].label + ' → ' + pg.N[p.to].label + ' · ' + dependencyWords(p.n) + tally, 'by level: ' + levels, 'kinds: ' + kinds],
    ask: 'click for the file pairs',
    note: dependencyWords(p.n) + (p.out ? ', ' + p.out + ' outward' : '') + excepted + '. By level: ' + levels + '.',
  };
}
// chipWords: a chip's tip — the box, what it reaches outside the view, how many dependencies, and their mark.
export function chipWords(title, ch) {
  var cls = markClass(ch.mark), mark = '';
  if (cls === ' bad') mark = ' · outward';
  if (cls === ' exc') mark = ' · ' + exceptedUntil(reviewPointWords(ch.earliest));
  return title + ' → ' + ch.t + ' · ' + dependencyWords(ch.n) + mark;
}
// moreChipText: the mark for `n` chips left out, "+N more".
export function moreChipText(n) {
  return '+' + n + ' more';
}
// moreChipWords: the mark for a box's chips left out and its tip naming each one and its dependencies.
export function moreChipWords(title, left) {
  return { t: moreChipText(left.length), tip: [title + ' also reaches'].concat(left.map(function (ch) { return ch.t + ' · ' + dependencyWords(ch.n); })) };
}
// countWords: a view's count line, as parts — a part with a class is bold in it. Its first sentence: the view's arrows
// and dependencies, the red and the orange ones, and what the arrows toggle leaves undrawn (undrawnWords); then the tail
// (countTail). No zero is said. `agg` is the view's (drawingView); `how` is { view, mode, selected, edge }: the view's id,
// null for the top, the arrows toggle, the selected box and the selected arrow.
export function countWords(agg, pg, how) {
  var t = agg.totals, tail = countTail(agg, pg, how.view);
  if (!t.arrows) return [{ t: 'no arrows' + tail, cls: '' }];
  var head = [{ t: plural(t.arrows, 'arrow') + ' (' + dependencyWords(t.n) + ')', cls: '' }];
  return head.concat(colourWords(t), [{ t: undrawnWords(agg, pg, how) + tail, cls: '' }]);
}
// colourWords: the count line's red and orange arrows, each bold in its colour; one at zero unsaid, both "none of them
// red or orange".
export function colourWords(t) {
  if (!t.red && !t.orange) return [{ t: ', none of them red or orange', cls: '' }];
  var w = [{ t: ': ', cls: '' }];
  if (t.red) w.push({ t: t.red + ' red', cls: 'bad' });
  if (t.red && t.orange) w.push({ t: ', ', cls: '' });
  if (t.orange) w.push({ t: t.orange + ' orange', cls: 'exc' });
  return w;
}
// undrawnWords: what the count line says when the arrows toggle (`how`, countWords') draws none of the view's arrows:
// Violations with none red or orange, how to see them all, whatever a selection or the hover draws; Selected with
// nothing selected; Selected with a box selected that none of them touches. Never by hover; nothing in All arrows.
export function undrawnWords(agg, pg, how) {
  var t = agg.totals, id = how.selected, noneMarked = !t.red && !t.orange;
  if (how.mode === 'bad' && noneMarked) return ': to see them all, choose All arrows';
  if (how.mode !== 'selected' || how.edge) return '';
  if (id == null) return '; click a box or an arrow to draw its arrows';
  var touched = agg.arrows.some(function (p) { return p.from === id || p.to === id; });
  return touched ? '' : '; ' + (pg.N[id] ? pg.N[id].label : id) + ' has none of them';
}
// countTail: the count line's tail, each part only when non-zero: the outward edges between boxes and the ones excepted,
// the ones inside boxes, not drawn, the boxes over the view's cap and a module's view's files over the page cap.
export function countTail(agg, pg, view) {
  var t = agg.totals, m = view != null ? pg.mods[view] : null, w = '';
  function more(n) { return n ? ' (' + n + ' more excepted)' : ''; }
  if (t.out) w += ' · outward between boxes ' + t.out + more(t.exc);
  else if (t.exc) w += ' · excepted between boxes ' + t.exc;
  if (t.insideOut) w += ' · inside boxes, not drawn: ' + t.insideOut + ' outward' + more(t.insideExc);
  else if (t.insideExc) w += ' · inside boxes, not drawn: ' + t.insideExc + ' excepted';
  if (agg.hidden) w += ' · ' + agg.hidden + ' more boxes not drawn';
  if (m && m.filesCut) w += ' · ' + m.filesCut + ' files over the page cap';
  return w;
}
