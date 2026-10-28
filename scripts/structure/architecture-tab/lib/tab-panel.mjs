// @level presentation
// Roadkeeper — the Architecture drawing's detail, a part of its one embedded entry (tabDrawing, tab-drawing.mjs): panelOf,
// the detail beside the drawing for a selection. Its other functions serve panelOf alone. Pure.
//
// The page embeds each function here by its own source, in one scope with the other parts' and the originals they
// call (architecture-tab.mjs, ORIGINALS).

import { countInWords, plural } from "../../../_text.mjs";
import { innerPastCount, severalRootFiles } from "./tab-counts.mjs";
import { MARK } from "./tab-data.mjs";
import { arrowWords, cycleLines, declLine, dependencyWords, exceptedUntil, levelList, markClass, skipNotes, tallyWords } from "./tab-words.mjs";

// panelOf: the detail beside the drawing, as blocks the client writes in order: { tag, cls, t, link, items }, each item
// { t, cls, link, lead, items }, its lead words bold before its text, its own items a list under it; a link is a
// repository file. `sel` names the selected arrow (`edge`), else the selected node (`id`), else the view (`view`, null
// for the top): its heading and note, then how to move around.
export function panelOf(sel, pg) {
  if (sel.edge) {
    var p = sel.edge;
    return [{ tag: 'h3', t: pg.N[p.from].label + ' → ' + pg.N[p.to].label }, { tag: 'p', cls: 'note', t: arrowWords(p, pg).note }, { tag: 'ul', items: edgeLines(p.edges, pg) }];
  }
  if (sel.id) return nodePanel(sel.id, pg);
  if (sel.view == null) return [{ tag: 'h3', t: 'All modules' }].concat(moveBlocks());
  return [{ tag: 'h3', t: sel.view }, { tag: 'p', cls: 'note', t: 'Its nested modules and files, each in the bands of its levels. Esc or the path above goes back up.' }].concat(moveBlocks());
}
// moveBlocks: how to move around the drawing, one move a line, each its words bold first.
export function moveBlocks() {
  return [{ tag: 'h4', t: 'How to move around' }, { tag: 'ul', cls: 'moves', items: [
    { lead: 'Click a box or an arrow', t: ': its detail shows here.' }, { lead: 'Double-click a module', t: ' to go inside it.' },
    { lead: 'Esc', t: ' clears the selection, then goes back up.' },
    { lead: 'Tab', t: ' moves between boxes and arrows, Space selects, Enter opens.' }, { lead: 'Drag', t: ' to move the drawing.' },
    { lead: 'Zoomed in, click the drawing', t: ' and the wheel scrolls it; shift + wheel scrolls sideways, ctrl + wheel zooms.' }] }];
}
// nodeNotes: what a node's detail notes under its levels: a module's files reached from outside, zero in words, and
// past the interface, then its skipNotes; a file on several levels and the exception covering them.
export function nodeNotes(id, pg) {
  var m = pg.mods[id], mx = pg.mixed && pg.mixed[id], notes = [], note = mx ? edgeNote(mx.mark, mx.until) : '';
  if (m && m.total != null) notes.push(countInWords(m.reached, 'none') + ' of ' + plural(m.total, 'file') + ' reached from outside' + (m.pastInterface ? ', ' + m.pastInterface + ' past the interface' : ''));
  if (m) notes = notes.concat(skipNotes(m));
  if (mx) notes.push('on several levels' + (note ? ',' + note : ''));
  return notes;
}
// nodePanel: a node's detail — its full path as its one name, a file's linked to the file; "Levels", each on its own
// line, outermost first; each note on its own line (nodeNotes); a module's entry and cycles, a file's declarations, the
// outward dependencies inside it, and what it depends on and what uses it outside it, each name with its dependencies.
export function nodePanel(id, pg) {
  var n = pg.N[id], m = pg.mods[id];
  if (!n) return [];
  var file = n.kind === 'file', levels = levelList(n.lv, pg.rings).map(function (t) { return { t: t }; });
  var out = [file ? { tag: 'h3', link: id } : { tag: 'h3', t: id }, { tag: 'h4', t: 'Levels' }, { tag: 'ul', items: levels }]
    .concat(nodeNotes(id, pg).map(function (t) { return { tag: 'p', cls: 'note', t: t }; }));
  if (m) out = out.concat(moduleBlocks(m, pg));
  if (file) out = out.concat(declBlocks(id, pg));
  var d = pg.node(id);
  if (!file && d.hidden.length) out.push({ tag: 'h4', t: 'Outward inside it' }, { tag: 'ul', items: edgeLines(d.hidden, pg) });
  var deps = d.deps.map(function (o) { return { t: o.t + ' · ' + dependencyWords(o.n) + tallyWords(o).map(function (w) { return w.t; }).join(''), cls: 'grp' + markClass(o.mark) }; });
  var users = d.users.map(function (u) { return { t: u.t + ' · ' + dependencyWords(u.n), cls: 'grp' }; });
  return out.concat([{ tag: 'h4', t: 'Depends on (outside)' }, { tag: 'ul', items: deps.length ? deps : [{ t: 'none' }] },
    { tag: 'h4', t: 'Used by (outside)' }, { tag: 'ul', items: users.length ? users : [{ t: 'none' }] }]);
}
// linkedFiles: files listed, each linked with the class `cls`, none when absent, and the ones over the page cap counted.
export function linkedFiles(files, cut, cls) {
  var items = files.map(function (f) { return { t: '', link: f, cls: cls }; });
  if (cut) items.push({ t: cut + ' more over the page cap' });
  return items;
}
// moduleBlocks: a module's entry, when it has one — its file, linked, and its exported declarations — its inner
// modules' files reached past it, its several root files, none in red, and the cycles it is in.
export function moduleBlocks(m, pg) {
  var items = [], out = [];
  if (m.entry) {
    items.push({ t: '', link: m.entry });
    (pg.decl[m.entry] || []).forEach(function (x) { var l = declLine(x, pg.declKinds); if (l.cls.indexOf('priv') < 0) items.push({ t: '   ' + l.t }); });
    out.push({ tag: 'h4', t: 'Entry' }, { tag: 'ul', items: items });
  }
  if (innerPastCount(m)) out.push({ tag: 'h4', t: 'Inner module files reached past the interface' }, { tag: 'ul', items: linkedFiles(m.innerPast || [], m.innerPastCut, 'bad') });
  if (severalRootFiles(m)) out.push({ tag: 'h4', t: 'Root files; a deep module has one, its entry' }, { tag: 'ul', items: linkedFiles(m.rootFiles, m.rootFilesCut) });
  if (m.cy.length) out.push({ tag: 'h4', t: 'In a cycle' }, { tag: 'ul', items: cycleLines(m.cy, pg.cycles).map(function (t) { return { t: t, cls: 'bad' }; }) });
  return out;
}
// declBlocks: a file's declarations, counted with the ones over the page cap; none, the count unsaid.
export function declBlocks(id, pg) {
  var cut = pg.declCut[id] || 0, items = (pg.decl[id] || []).map(function (x) { return { t: declLine(x, pg.declKinds).t }; }), n = items.length;
  if (cut) items.push({ t: cut + ' more over the page cap' });
  else if (!n) items.push({ t: 'none listed' });
  return [{ tag: 'h4', t: 'Declarations' + (n + cut ? ' (' + (n + cut) + ')' : '') }, { tag: 'ul', items: items }];
}
// edgeLines: a list of file edges in the detail, each with its levels, kind, count and note, its class by its mark; at
// most two hundred, the rest counted: more than a reader scans, and the panel stays a few hundred nodes however many
// edges one arrow carries.
export function edgeLines(list, pg) {
  var max = 200, out = list.slice(0, max).map(function (e) {
    var kind = pg.kinds[e.kind], cls = markClass(e.mark).trim();
    var levels = (e.fromLevel >= 0 ? pg.names[e.fromLevel] : 'no level') + ' → ' + (e.toLevel >= 0 ? pg.names[e.toLevel] : 'no level');
    return { t: e.from + ' → ' + e.to + ' (' + levels + ')' + (kind !== 'dependency' ? ' [' + kind + ']' : '') + (e.n > 1 ? ' ×' + e.n : '') + edgeNote(e.mark, e.until), cls: cls };
  });
  if (list.length > max) out.push({ t: 'and ' + (list.length - max) + ' more' });
  return out;
}
// edgeNote: what the detail says after an edge's ends, by its mark — the exception covering it and its review point,
// and whether it is due.
export function edgeNote(mark, until) {
  if (mark === MARK.excepted) return ' ' + exceptedUntil(until);
  if (mark === MARK.due) return ' ' + exceptedUntil(until) + ', due';
  return '';
}
