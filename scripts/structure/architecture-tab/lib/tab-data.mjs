// @level presentation
// Roadkeeper — the Architecture tab's data: the view's data, from structureModel's output (structure-model.mjs) and the check's
// rulings (rulings.mjs), which the page ships as JSON and the client's counting (tab-counts.mjs) folds into views. Pure.

import { codeFiles } from "../../lib/module-records.mjs";
import { isCodeEdge } from "../../lib/source-paths.mjs";
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

// The view's data: modules with their count, levels, entry and root files (several marked as the check rules them,
// rootFilesMark and rootFilesUntil), the files no module holds with their levels (`loose`), the
// files of mixed levels with their levels and mark (`mixed`, [file, levels, mark, until]), file-level
// edges with their mark, count, modules (null for a file no module holds), exception's review point (null when none) and
// two files' levels, the declarations the cards show, the declared relations between
// drawn modules, and the cycles. The edges come folded by the check, and every judgement is the check's (the rulings'
// output): an edge's mark follows its rulings, a test file's edges are not drawn, a card counts the entry skips the
// check rules. The drawing is the code's (SOURCE): a module's other files and the edges reaching them are left out. The ends of every line come resolved from the reader
// (fromModule, toModule, fromLevel, toLevel, fileLevels); nothing here or in the client walks a path to find its module
// or level. A level travels as its index in the rings read innermost first, -1 for none.
// `caps`: one size step's; a cap it leaves out takes the first step's.
export function tabData(model, caps, check) {
  const limits = { ...SIZE_STEPS[0], ...caps };
  const levelIndexes = new Map(model.rings.flat().map((name, index) => [name, index]));
  const levelIndex = (level) => (level != null && levelIndexes.has(level) ? levelIndexes.get(level) : -1);
  const { all, kept } = sortModules(model, limits);
  const byPath = new Map(kept.map((m) => [m.path, m]));
  // the files no module holds, each a box of its own at the top, with its level; past the cap counted with the files
  const looseAll = model.loose || [], looseKept = looseAll.slice(0, limits.maxModules);
  const fileLevels = model.fileLevels || {};
  // a file's own level, undefined when the model knows none
  const ownLevel = (f) => (Object.hasOwn(fileLevels, f) ? fileLevels[f] : undefined);
  const { edgesAll, edges, outside, notDrawn } = listDrawnEdges(model, check, { kept, byPath, looseKept, levelIndex, limits });
  const groups = check.cycles.cycles;
  const view = { byPath, ownLevel, levelIndex, limits, inCycle: indexCycleGroups(groups) };
  const modules = kept.map((m) => buildModuleRow(m, check, view));
  const shownFiles = new Set(looseKept);
  for (const m of modules) { if (m.entry) shownFiles.add(m.entry); for (const f of m.files || []) shownFiles.add(f); }
  const { decls, declCut } = listShownDecls(model, shownFiles, limits);
  const { relations, relationsCut, unresolved } = listDrawnRelations(model, byPath, limits);
  // the files of mixed levels the page can show: each with its levels, its mark and its exception's review point
  const mixed = [];
  for (const [f, x] of check.mixed || []) if (shownFiles.has(f)) mixed.push([f, x.levels.map(levelIndex), markFor(x.exception), x.exception ? x.exception.until : null]);
  return {
    rings: model.rings, kinds: EDGE_KINDS, declKinds: DECL_KINDS, fields: EDGE_FIELDS, modules, loose: looseKept.map((f) => [f, levelIndex(ownLevel(f))]),
    mixed, edges, decls, relations,
    cycles: groups.map((g) => ({ parent: g.parent, modules: g.modules, moreModules: g.moreModules, pairs: g.pairs, morePairs: g.morePairs })),
    outside, notDrawn, unresolved,
    cut: {
      cycles: check.cycles.more,
      modules: all.length - kept.length, edges: edgesAll.length - edges.length, decls: declCut, relations: relationsCut,
      files: modules.reduce((n, m) => n + m.filesCut, looseAll.length - looseKept.length),
    },
  };
}

// The modules, outermost first, then by path, a module spanning levels sorting by its outermost one: { all, kept },
// kept the ones under the cap.
function sortModules(model, limits) {
  const outer = (module) => module.ring ?? Math.max(-1, ...(module.levels || []).map((level) => placed(model, level).ring ?? -1));
  const all = [...model.modules].sort((a, b) => outer(b) - outer(a) || comparePaths(a.path, b.path));
  return { all, kept: all.slice(0, limits.maxModules) };
}

// two paths in code-unit order
function comparePaths(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

// The check's folded edges the page draws, outward first so a cap keeps what the page must show: { edgesAll, edges,
// outside, notDrawn }, edges as tuples in EDGE_FIELDS' order under the cap; outside counts the edges leaving the code
// read, notDrawn the ones reaching a module or file past the cap.
function listDrawnEdges(model, check, { kept, byPath, looseKept, levelIndex, limits }) {
  const index = new Map(kept.map((m, i) => [m.path, i])), drawnLoose = new Set(looseKept);
  // an end in no module and none of the files no module holds leaves the code read
  const unread = (end) => !end.module && !end.loose;
  // the drawing is the code's: an edge with an end that is no code file, a stylesheet or a data file, is not drawn
  // and is counted nowhere
  let outside = 0, notDrawn = 0;
  for (const edge of model.edges) if (isCodeEdge(edge) && edgeEnds(edge).some(unread)) outside++;
  // each end drawn: its module kept, or its file kept among the files no module holds
  const drawn = (end) => (end.module ? byPath.has(end.module) : drawnLoose.has(end.file));
  // one from outside the code read is counted above
  const folded = [];
  for (const edge of check.edges.values()) {
    const [from, to] = edgeEnds(edge);
    if (!isCodeEdge(edge) || unread(from)) continue;
    if (!drawn(from) || !drawn(to)) { notDrawn += edge.n; continue; }
    if (edge.rulings.has("test")) continue; // the drawing is the code's; tests reach it from outside
    folded.push({
      from: edge.from, to: edge.to, kind: EDGE_KINDS.indexOf(edge.kind), mark: markEdge(edge), n: edge.n,
      fromModule: from.module ? index.get(from.module) : null, toModule: to.module ? index.get(to.module) : null, until: edge.until,
      fromLevel: levelIndex(edge.fromLevel), toLevel: levelIndex(edge.toLevel),
    });
  }
  const edgesAll = folded.sort(outwardFirst);
  return { edgesAll, edges: edgesAll.slice(0, limits.maxEdges).map((e) => EDGE_FIELDS.map((f) => e[f])), outside, notDrawn };
}

// an edge's mark by its rulings: inward, else by the exception covering it, which sets its review point
function markEdge(edge) {
  if (!edge.rulings.has("outward")) return MARK.inward;
  const exception = edge.until === null ? null : { due: edge.rulings.has("due") };
  return markFor(exception);
}

// the cycle groups each module is in, by index into the list shipped
function indexCycleGroups(groups) {
  const inCycle = new Map();
  groups.forEach((g, i) => g.modules.forEach((p) => { if (!inCycle.has(p)) inCycle.set(p, []); inCycle.get(p).push(i); }));
  return inCycle;
}

// One kept module as the page ships it: its files and root files under the caps, the shipped files whose level is not
// its own, its cycle groups and the check's record of it.
function buildModuleRow(module, check, { byPath, ownLevel, levelIndex, limits, inCycle }) {
  const entry = module.entry, record = check.modules.get(module.path);
  // its code files only, as the check's record counts them
  const listed = codeFiles(module.files), roots = module.rootFiles;
  const shipFiles = listed ? listed.slice(0, limits.maxFiles) : null, shipRoots = roots.slice(0, limits.maxRootFiles);
  // the shipped files whose level is not the module's own: a root file's at another level, or a private file's
  const otherLevelFiles = [];
  for (const file of new Set([...shipRoots, ...(shipFiles || [])])) {
    const level = ownLevel(file);
    if (level !== undefined && level !== module.level) otherLevelFiles.push([file, levelIndex(level)]);
  }
  return {
    p: module.path, level: module.level, ring: module.ring, parent: module.parent && byPath.has(module.parent) ? module.parent : null,
    l: levelIndex(module.level), lv: (module.levels || []).map(levelIndex), lf: otherLevelFiles, cy: inCycle.get(module.path) || [],
    entry, rootFiles: shipRoots, rootFilesCut: roots.length - shipRoots.length,
    files: shipFiles, filesCut: listed ? Math.max(0, listed.length - limits.maxFiles) : 0,
    ...record,
    // its inner modules' files reached past it, cut as its own files are
    innerPast: record.innerPast.slice(0, limits.maxFiles), innerPastCut: Math.max(0, record.innerPast.length - limits.maxFiles),
    ...readRootFilesException(check.rootFiles, module.path),
  };
}

// Declarations of the files the page can show, exported first, then by kind and name, under the caps: { decls,
// declCut }, each [file, its shipped declarations, how many cut, how many exported ones cut], so a module's card counts
// its interface past what was shipped.
function listShownDecls(model, shownFiles, limits) {
  const decls = [];
  let declCount = 0, declCut = 0;
  for (const fileDecls of model.declarations || []) {
    if (!shownFiles.has(fileDecls.file)) continue;
    const list = [...fileDecls.decls].sort((x, y) => y.exported - x.exported || DECL_KINDS.indexOf(x.kind) - DECL_KINDS.indexOf(y.kind) || (x.name < y.name ? -1 : 1));
    const take = list.slice(0, Math.min(DECLS_PER_FILE, Math.max(0, limits.maxDecls - declCount)));
    declCut += list.length - take.length; declCount += take.length;
    decls.push([fileDecls.file, take.map((x) => [x.name, DECL_KINDS.indexOf(x.kind), x.exported ? 1 : 0]), list.length - take.length, list.filter((x) => x.exported).length - take.filter((x) => x.exported).length]);
  }
  return { decls, declCut };
}

// The declared relations between two kept modules, one per pair and kind, under the cap: { relations, relationsCut,
// unresolved }, unresolved counting the ones naming no kept module, or one module twice.
function listDrawnRelations(model, byPath, limits) {
  const byPairAndKind = new Map();
  let unresolved = 0;
  for (const relation of model.relations) {
    const { fromModule, toModule, kind } = relation;
    const betweenKept = fromModule && toModule && fromModule !== toModule && byPath.has(fromModule) && byPath.has(toModule);
    if (!betweenKept) { unresolved++; continue; }
    byPairAndKind.set(`${fromModule}\n${toModule}\n${kind}`, { a: fromModule, b: toModule, k: kind });
  }
  const relations = [...byPairAndKind.values()].slice(0, limits.maxRelations);
  return { relations, relationsCut: byPairAndKind.size - relations.length, unresolved };
}

// a module's several root files as the check rules them (rulings' rootFiles, by module): their mark and their
// exception's review point (null when none); nothing for a module with one
function readRootFilesException(rootFiles, path) {
  if (!rootFiles.has(path)) return {};
  const exception = rootFiles.get(path);
  return { rootFilesMark: markFor(exception), rootFilesUntil: exception ? exception.until : null };
}

// what breaks a rule, an outward edge, a file of mixed levels or a module's several root files, marked by the exception
// covering it: outward with none, excepted, or due
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
