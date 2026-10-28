// @level domain
// Roadkeeper — the Architecture tab's data: the view's data, from structureModel's output (structure-model.mjs) and the check's
// rulings (rulings.mjs), which the page ships as JSON and the client's counting (tab-counts.mjs) folds into views. Pure.

import { DECL_KINDS, EDGE_KINDS, edgeEnds, placed } from "../../lib/structure-model.mjs";

// an edge's mark on the page: 0 inward, 1 outward, 2 outward but covered by a declared exception, 3 outward and its
// exception due; drawsRed says which draw red. The page embeds it as JSON.
export const MARK = { inward: 0, outward: 1, excepted: 2, due: 3 };
// the detail column lists at most this many of a file's declarations
const DECLS_PER_FILE = 40;
// an edge's fields, named once: the page's edges are tuples in this order, and the client's drawing reads them by name
const EDGE_FIELDS = ["from", "to", "kind", "mark", "n", "fromModule", "toModule", "until", "fromLevel", "toLevel"];

// The drawing's caps at each size step, tightening; a cut is counted and said. Past the last step the drawing is left out.
export const SIZE_STEPS = [
  { maxModules: 2000, maxFiles: 400, maxRootFiles: 50, maxEdges: 20000, maxDecls: 20000, maxRelations: 500 },
  { maxModules: 1000, maxFiles: 100, maxRootFiles: 20, maxEdges: 5000, maxDecls: 5000, maxRelations: 200 },
  { maxModules: 300, maxFiles: 0, maxRootFiles: 10, maxEdges: 1000, maxDecls: 0, maxRelations: 50 },
];

// The view's data: modules with their gauge, levels, entry and root files, the files no module holds with their levels (`loose`), the
// files of mixed levels with their levels and mark (`mixed`, [file, levels, mark, until]), file-level
// edges with their mark, count, modules (null for a file no module holds), exception's review point (null when none) and
// two files' levels, the declarations the cards show, the declared relations between
// drawn modules, and the cycles. The edges come folded by the check, and every judgement is the check's (the rulings'
// output): an edge's mark follows its rulings, a test file's edges are not drawn, a card counts the entry skips the
// check rules. The ends of every line come resolved from the reader
// (fromModule, toModule, fromLevel, toLevel, fileLevels); nothing here or in the client walks a path to find its module
// or level. A level travels as its index in the rings read innermost first, -1 for none.
// `caps`: one size step's; a cap it leaves out takes the first step's.
export function tabData(sm, caps, check) {
  const c = { ...SIZE_STEPS[0], ...caps };
  const names = sm.rings.flat(), li = new Map(names.map((n, i) => [n, i]));
  const lix = (level) => (level != null && li.has(level) ? li.get(level) : -1);
  // a module spanning levels sorts by its outermost one
  const outer = (m) => m.ring ?? Math.max(-1, ...(m.levels || []).map((l) => placed(sm, l).ring ?? -1));
  const all = [...sm.modules].sort((a, b) => outer(b) - outer(a) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const kept = all.slice(0, c.maxModules), byPath = new Map(kept.map((m) => [m.path, m]));
  const index = new Map(kept.map((m, i) => [m.path, i]));
  // an edge's mark by its rulings: inward, else by the exception covering it, which sets its review point
  const markOf = (r) => {
    if (!r.rulings.has("outward")) return MARK.inward;
    const exception = r.until === null ? null : { due: r.rulings.has("due") };
    return markFor(exception);
  };
  // the files no module holds, each a box of its own at the top, with its level; past the cap counted with the files
  const looseAll = sm.loose || [], looseKept = looseAll.slice(0, c.maxModules), drawnLoose = new Set(looseKept);
  const fileLevels = sm.fileLevels || {};
  // a file's own level, undefined when the model knows none
  const ownLevel = (f) => (Object.hasOwn(fileLevels, f) ? fileLevels[f] : undefined);
  const levelIn = (f) => lix(ownLevel(f));
  let outside = 0, notDrawn = 0;
  // an end in no module and none of the files no module holds leaves the code read
  const unread = (end) => !end.module && !end.loose;
  for (const e of sm.edges) if (edgeEnds(e).some(unread)) outside++;
  // each end drawn: its module kept, or its file kept among the files no module holds
  const drawn = (end) => (end.module ? byPath.has(end.module) : drawnLoose.has(end.file));
  // the check's folded edges; one from outside the code read is counted above
  const folded = [];
  for (const r of check.edges.values()) {
    const [from, to] = edgeEnds(r);
    if (unread(from)) continue;
    if (!drawn(from) || !drawn(to)) { notDrawn += r.n; continue; }
    if (r.rulings.has("test")) continue; // the drawing is the code's; tests reach it from outside
    folded.push({
      from: r.from, to: r.to, kind: EDGE_KINDS.indexOf(r.kind), mark: markOf(r), n: r.n,
      fromModule: from.module ? index.get(from.module) : null, toModule: to.module ? index.get(to.module) : null, until: r.until, fromLevel: lix(r.fromLevel), toLevel: lix(r.toLevel),
    });
  }
  // outward first, so a cap keeps what the page must show
  const edgesAll = folded.sort(outwardFirst);
  const edges = edgesAll.slice(0, c.maxEdges).map((e) => EDGE_FIELDS.map((f) => e[f]));
  // the cycle groups each drawn module is in, by index into the list shipped
  const groups = check.cycles.cycles, inCycle = new Map();
  groups.forEach((g, i) => g.modules.forEach((p) => { if (!inCycle.has(p)) inCycle.set(p, []); inCycle.get(p).push(i); }));
  const modules = kept.map((m) => {
    const entry = m.entry, rec = check.modules.get(m.path);
    const listed = m.files && m.files.length ? m.files : null, roots = m.rootFiles;
    const shipFiles = listed ? listed.slice(0, c.maxFiles) : null, shipRoots = roots.slice(0, c.maxRootFiles);
    // the shipped files whose level is not the module's own: a root file's at another level, or a private file's
    const lf = [];
    for (const f of new Set([...shipRoots, ...(shipFiles || [])])) {
      const l = ownLevel(f);
      if (l !== undefined && l !== m.level) lf.push([f, lix(l)]);
    }
    return {
      p: m.path, level: m.level, ring: m.ring, parent: m.parent && byPath.has(m.parent) ? m.parent : null,
      l: lix(m.level), lv: (m.levels || []).map(lix), lf, cy: inCycle.get(m.path) || [],
      entry, rootFiles: shipRoots, rootFilesCut: roots.length - shipRoots.length,
      files: shipFiles, filesCut: listed ? Math.max(0, listed.length - c.maxFiles) : 0,
      ...rec,
      // its inner modules' files reached past it, cut as its own files are
      innerPast: rec.innerPast.slice(0, c.maxFiles), innerPastCut: Math.max(0, rec.innerPast.length - c.maxFiles),
    };
  });
  // declarations of the files the page can show: exported first, then by kind and name
  const shownFiles = new Set(looseKept);
  for (const m of modules) { if (m.entry) shownFiles.add(m.entry); for (const f of m.files || []) shownFiles.add(f); }
  const decls = [];
  let declCount = 0, declCut = 0;
  for (const d of sm.declarations || []) {
    if (!shownFiles.has(d.file)) continue;
    const list = [...d.decls].sort((x, y) => y.exported - x.exported || DECL_KINDS.indexOf(x.kind) - DECL_KINDS.indexOf(y.kind) || (x.name < y.name ? -1 : 1));
    const take = list.slice(0, Math.min(DECLS_PER_FILE, Math.max(0, c.maxDecls - declCount)));
    declCut += list.length - take.length; declCount += take.length;
    // the counts cut: all, and exported — a module's card counts its interface past what was shipped
    decls.push([d.file, take.map((x) => [x.name, DECL_KINDS.indexOf(x.kind), x.exported ? 1 : 0]), list.length - take.length, list.filter((x) => x.exported).length - take.filter((x) => x.exported).length]);
  }
  const rel = new Map();
  let unresolved = 0;
  for (const r of sm.relations) {
    if (!r.fromModule || !r.toModule || r.fromModule === r.toModule || !byPath.has(r.fromModule) || !byPath.has(r.toModule)) { unresolved++; continue; }
    rel.set(`${r.fromModule}\n${r.toModule}\n${r.kind}`, { a: r.fromModule, b: r.toModule, k: r.kind });
  }
  const relations = [...rel.values()].slice(0, c.maxRelations);
  // the files of mixed levels the page can show: each with its levels, its mark and its exception's review point
  const mixed = [];
  for (const [f, x] of check.mixed || []) if (shownFiles.has(f)) mixed.push([f, x.levels.map(lix), markFor(x.exception), x.exception ? x.exception.until : null]);
  return {
    rings: sm.rings, kinds: EDGE_KINDS, declKinds: DECL_KINDS, fields: EDGE_FIELDS, modules, loose: looseKept.map((f) => [f, levelIn(f)]),
    mixed, edges, decls, relations,
    cycles: groups.map((g) => ({ parent: g.parent, modules: g.modules, moreModules: g.moreModules, pairs: g.pairs, morePairs: g.morePairs })),
    outside, notDrawn, unresolved,
    cut: {
      cycles: check.cycles.more,
      modules: all.length - kept.length, edges: edgesAll.length - edges.length, decls: declCut, relations: rel.size - relations.length,
      files: modules.reduce((n, m) => n + m.filesCut, looseAll.length - looseKept.length),
    },
  };
}

// what breaks a rule, an outward edge or a file of mixed levels, marked by the exception covering it: outward with
// none, excepted, or due
function markFor(exception) {
  if (!exception) return MARK.outward;
  return exception.due ? MARK.due : MARK.excepted;
}

// whether a mark draws red: outward, uncovered or its exception due. The page embeds it by its source.
export function drawsRed(mark) {
  return mark === MARK.outward || mark === MARK.due;
}
// the order of file edges: an outward one first, then by mark, highest first. The page embeds it by its source.
export function outwardFirst(x, y) {
  return (y.mark === MARK.outward) - (x.mark === MARK.outward) || y.mark - x.mark;
}
