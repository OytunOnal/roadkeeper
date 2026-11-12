// @level domain
// Roadkeeper — the structure check: what in a project's declared structure breaks its own rules; the structure report
// says it in its lines (report-lines.mjs). Pure: rulings takes structureModel's output (structure-model.mjs), today and
// the versions closed on the tracker, and returns the violations and the debt; the callers read the files, the clock
// and the snapshot.
//
// The rules: skills/slice/references/structure.md: The shape, the template's Rules, Known debt.

import { MAX_DEPTH, SOURCE, globMatch, isCodeEdge, pathAndParents, underPath } from "./source-paths.mjs";
import { closedVersions, reviewPointDue } from "./review-points.mjs";
import { outward, placed } from "./structure-model.mjs";
import { moduleRecords } from "./module-records.mjs";

// a project declares a few test patterns and a few exceptions; past these the rest are counted unread, so the check's
// cost stays bounded by its input's size
export const MAX_TESTS = 20, MAX_EXCEPTIONS = 1000;
// the cyclic groups a report names: enough to see every tangle of a project; past it they are counted
export const MAX_CYCLES = 50;
// the modules a group's line names: a tangle's members at a glance; past it they are counted
const MAX_CYCLE_MODULES = 20;
// the two-way pairs listed under a group, where a fix starts; past it they are counted
const MAX_CYCLE_PAIRS = 20;

// the grade each kind is filed at: a test past the interface and a cycle are judgements
export const KINDS = {
  "no-level": "hard",
  "root-files": "hard",
  "mixed-levels": "hard",
  "outward": "hard",
  "past-entry": "hard",
  "test-past-interface": "judgement",
  "level-name": "judgement",
  "cycle": "judgement",
};

// whether a path is a test, by the first MAX_TESTS `## Tests` patterns, each path matched once
export function testOf(tests) {
  const first = tests.slice(0, MAX_TESTS), memo = new Map();
  return (f) => { if (!memo.has(f)) memo.set(f, first.some((p) => globMatch(p, f))); return memo.get(f); };
}

// An exception is due when its review point is, each point decided once.
function dueRule(today, closedVersions) {
  const memo = new Map();
  return (x) => {
    if (!memo.has(x.until)) memo.set(x.until, reviewPointDue(x.until, today, closedVersions));
    return memo.get(x.until);
  };
}

// The options a check judges under, built once from the caller's and handed down unchanged. The rulings read `today`
// and the versions closed on the tracker snapshot, `snapshot` or null; the report's lines (report-lines.mjs) read
// whether a snapshot was read, `snapshotOptional`, whether a version exception with none is a note, not unread, and
// `stamping`, the version a stamp is about to write, or null.
export function judgingOptions({ snapshot = null, today = null, stamping = null, snapshotOptional = false } = {}) {
  return { today, closedVersions: snapshot ? closedVersions(snapshot) : [], snapshotRead: Boolean(snapshot), snapshotOptional, stamping };
}

// one dependency between two files, folded by its ends and kind
const edgeKey = (e) => `${e.from}\n${e.to}\n${e.kind}`;

// The check, under `judging` (judgingOptions) (GLOSSARY: Ruling, Exception, Due, Debt):
// - violations, each with its kind, grade and ends (a level named like a module's folder: the level and the module)
//   and, when an exception covers it, that exception, due;
// - debt: what an exception not yet due still covers, apart from the violations;
// - edges: each folded edge into the code read, a module or a file no module holds, by a key private to the check: its
//   ends, kind and modules (null for a file no module holds) and whether each end is one of those files, how many times
//   it was read (n), its two files' levels, its rulings, and the review point (until) of the exception that covers it,
//   null when none;
// - mixed: each file of mixed levels, but a test, with its levels and the exception covering it, with whether it is
//   due, or null;
// - rootFiles: each module with several root files, with the exception covering them, with whether it is due, or null;
// - modules: each module's record (module-records.mjs, moduleRecords);
// - the cycles, and what was not read past the caps.
export function rulings(sm, judging = judgingOptions()) {
  const isDue = dueRule(judging.today, judging.closedVersions);
  const byPath = new Map(sm.modules.map((m) => [m.path, m]));
  const exceptions = sm.exceptions.slice(0, MAX_EXCEPTIONS), isTest = testOf(sm.tests);
  // the modules holding a module's files, itself first, then each module around it
  const heldBy = (m) => {
    const c = [m];
    let t = m;
    while (c.length <= MAX_DEPTH) {
      t = t.parent ? byPath.get(t.parent) : null;
      if (!t) break;
      c.push(t);
    }
    return c;
  };
  const violations = [], debt = [];
  // exceptions by their `from`, found by walking up the edge's folders: an edge costs its depth times the exceptions
  // sharing one `from`, never every exception
  // an exception naming one path covers that path's own rulings, never an edge: a file's mixed levels and missing level,
  // a module's root files and missing level
  const byFrom = new Map(), exceptionByPath = new Map();
  for (const x of exceptions) {
    if (x.path) { if (!exceptionByPath.has(x.path)) exceptionByPath.set(x.path, x); continue; }
    const l = byFrom.get(x.from) || []; l.push(x); byFrom.set(x.from, l);
  }
  const exceptionFor = (from, to) => {
    for (const p of pathAndParents(from)) for (const x of byFrom.get(p) || []) if (underPath(to, x.to)) return x;
    return null;
  };
  // the exception covering a violation: an edge's by its ends, any other by the path it names
  const coveringException = (v) => {
    if (v.from) return exceptionFor(v.from, v.to);
    return exceptionByPath.get(v.file || v.module) || null;
  };
  // a violation filed as such or as debt; returns the exception that covers it, with whether it is due, or null
  const report = (v) => {
    const x = coveringException(v);
    if (!x) { violations.push(v); return null; }
    const exception = { line: x.line, until: x.until, untilKind: x.untilKind, due: isDue(x) };
    (exception.due ? violations : debt).push({ ...v, exception });
    return exception;
  };
  // a deep module has one entry (ADR 0005): several files at its root are one ruling naming them all, none the entry.
  // Each with the exception covering it, for the page
  const rootFiles = new Map();
  for (const m of sm.modules) {
    if (m.level == null) report({ kind: "no-level", grade: KINDS["no-level"], module: m.path });
    if (m.rootFiles.length > 1) rootFiles.set(m.path, report({ kind: "root-files", grade: KINDS["root-files"], module: m.path, files: [...m.rootFiles].sort() }));
  }
  // a file no module holds carries its own tag, and so does a private file: it takes no level from its entry (ADR 0005)
  const untagged = (f) => sm.fileLevels[f] == null && !isTest(f);
  for (const f of sm.loose) if (untagged(f)) report({ kind: "no-level", grade: KINDS["no-level"], file: f });
  for (const m of sm.modules) {
    const rootFileSet = new Set(m.rootFiles);
    // a source file below the root; a root file is judged as the module
    const isPrivate = (f) => SOURCE.test(f) && !rootFileSet.has(f);
    for (const f of m.files || []) if (isPrivate(f) && untagged(f)) report({ kind: "no-level", grade: KINDS["no-level"], file: f });
  }
  // a file naming several levels mixes them; a deep module whose files hold different levels does not. Each with the
  // exception covering it, for the page
  const mixed = new Map();
  for (const f of Object.keys(sm.mixed || {}).sort()) {
    if (isTest(f)) continue;
    const exception = report({ kind: "mixed-levels", grade: KINDS["mixed-levels"], file: f, levels: sm.mixed[f] });
    mixed.set(f, { levels: sm.mixed[f], exception });
  }
  // an edge into the code read — a module, or a file no module holds — is ruled; one leaving it gets no rulings, and the
  // page counts it outside. A dependency with an end that is no code file, a stylesheet or a data file, gets none either
  const edges = new Map();
  for (const e of sm.edges) {
    if (!isCodeEdge(e)) continue;
    const key = edgeKey(e), seen = edges.get(key);
    if (seen) { seen.n++; continue; }
    const a = e.fromModule ? byPath.get(e.fromModule) : null, b = e.toModule ? byPath.get(e.toModule) : null, test = isTest(e.from);
    if (!b && !e.toLoose) continue;
    // file to file: the two files' levels, whatever modules hold them
    const out = !test && outward(placed(sm, e.fromLevel), placed(sm, e.toLevel));
    const edge = {
      from: e.from, to: e.to, kind: e.kind, n: 1, fromModule: e.fromModule, toModule: b ? b.path : null, fromLevel: e.fromLevel, toLevel: e.toLevel,
      fromLoose: e.fromLoose, toLoose: e.toLoose,
      rulings: new Set([test ? "test" : out ? "outward" : "inward"]), until: null,
    };
    edges.set(key, edge);
    const rule = (v) => {
      const exception = report(v);
      if (v.kind !== "outward") edge.rulings.add(v.kind);
      if (v.skipped) edge.skipped = v.skipped;
      if (exception) { edge.rulings.add(exception.due ? "due" : "excepted"); edge.until = exception.until; }
    };
    const ends = { from: e.from, to: e.to, edge: e.kind, module: b ? b.path : null };
    // the entry rule holds for a module only: a file no module holds is reached by any file
    let breach = null;
    if (b) breach = test ? testPastInterface(a, heldBy(b), e.to) : pastEntry(a, heldBy(b), e.to);
    if (breach) rule({ grade: KINDS[breach.kind], ...ends, ...breach });
    if (out) rule({ kind: "outward", grade: KINDS["outward"], ...ends });
  }
  // levels are layers, not folders: a level named like a module's last folder, in any case, once per module
  for (const m of sm.modules) {
    const level = m.path.slice(m.path.lastIndexOf("/") + 1).toLowerCase();
    if (sm.ringOf[level] !== undefined) violations.push({ kind: "level-name", grade: KINDS["level-name"], level, module: m.path });
  }
  // a cycle is pushed as it is: no exception hides one
  const c = moduleCycles(sm, isTest);
  for (const x of c.cycles) violations.push({ kind: "cycle", grade: KINDS["cycle"], ...x });
  const unread = { tests: Math.max(0, sm.tests.length - MAX_TESTS), exceptions: sm.exceptions.length - exceptions.length };
  return { violations, debt, unread, cycles: c, edges, modules: moduleRecords(sm, edges, isTest), mixed, rootFiles };
}

// The entry rule on an edge to file `to` from module `from` (null for none) into the modules `held` holding `to`, the
// deepest first: a file in a module's folder other than its own root files is private to it, an inner module's root
// files too; while a module has several root files, the root-files ruling is the one that names them, so an edge into
// any of them crosses nothing. `crossed`, the modules it reaches from outside past their root files; `skipped`, the
// module a breach counts at: the outermost one crossed, else the deepest; `intoRootFile`, whether `to` is a root file of
// the deepest module.
function crossing(from, held, to) {
  const isRootFile = (m) => m.rootFiles.includes(to);
  const outside = (m) => !from || !underPath(from.path, m.path);
  const crossed = held.filter((m) => outside(m) && !isRootFile(m));
  return { crossed, skipped: (crossed.at(-1) || held[0]).path, intoRootFile: isRootFile(held[0]) };
}
// A code edge breaks the entry rule reaching a module from outside past an entry: { kind, skipped }, or null.
function pastEntry(from, held, to) {
  const c = crossing(from, held, to);
  return c.crossed.length ? { kind: "past-entry", skipped: c.skipped } : null;
}
// A test's edge breaks it past the interface, from inside the deepest module too: { kind, skipped }, or null.
function testPastInterface(from, held, to) {
  const c = crossing(from, held, to);
  return c.crossed.length || !c.intoRootFile ? { kind: "test-past-interface", skipped: c.skipped } : null;
}

// The strongly connected parts of a graph given as adjacency lists of indices (Tarjan's, iterative so a long chain
// cannot overflow the stack): each part a list of indices.
function components(adj) {
  const index = new Array(adj.length).fill(-1), low = new Array(adj.length).fill(0), on = new Array(adj.length).fill(false);
  const stack = [], out = [];
  let next = 0;
  for (let s = 0; s < adj.length; s++) {
    if (index[s] >= 0) continue;
    index[s] = low[s] = next++; stack.push(s); on[s] = true;
    const work = [[s, 0]];
    while (work.length) {
      const top = work[work.length - 1], v = top[0];
      if (top[1] < adj[v].length) {
        const w = adj[v][top[1]++];
        if (index[w] < 0) { index[w] = low[w] = next++; stack.push(w); on[w] = true; work.push([w, 0]); }
        else if (on[w]) low[v] = Math.min(low[v], index[w]);
        continue;
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
      if (low[v] === index[v]) {
        const part = [];
        let w;
        do { w = stack.pop(); on[w] = false; part.push(w); } while (w !== v);
        out.push(part);
      }
    }
  }
  return out;
}

// The cycles among modules nested in one parent, and among top modules. An edge between two modules counts for the two
// siblings under the deepest module holding both — a parent and its child are no pair; a test's edge, or one with an end
// that is no code file, is no dependency.
// Each strongly connected group of two or more modules is one cycle, found in one linear walk: its modules sorted, then
// the two-way pairs inside it. { cycles: [{ parent (null among top modules), modules, moreModules, pairs, morePairs }]
// (the first MAX_CYCLES groups, by parent and first module, each cut at MAX_CYCLE_MODULES and MAX_CYCLE_PAIRS), more }
function moduleCycles(sm, isTest) {
  const byPath = new Map(sm.modules.map((m) => [m.path, m])), chains = new Map();
  // a module's path of modules from its top one down; a parent is a strict prefix, so the walk ends
  const chainOf = (m) => {
    if (!chains.has(m.path)) {
      const c = [];
      for (let t = m; t; t = t.parent ? byPath.get(t.parent) : null) c.push(t.path);
      chains.set(m.path, c.reverse());
    }
    return chains.get(m.path);
  };
  const groups = new Map(), pairs = new Set();
  for (const e of sm.edges) {
    if (!e.fromModule || !e.toModule || e.fromModule === e.toModule || isTest(e.from) || !isCodeEdge(e)) continue;
    const a = byPath.get(e.fromModule), b = byPath.get(e.toModule);
    if (!a || !b) continue;
    const ca = chainOf(a), cb = chainOf(b);
    let i = 0;
    while (i < ca.length && i < cb.length && ca[i] === cb[i]) i++;
    if (i === ca.length || i === cb.length) continue;
    const parent = i ? ca[i - 1] : null, pair = `${parent}\n${ca[i]}\n${cb[i]}`;
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    if (!groups.has(parent)) groups.set(parent, new Map());
    const g = groups.get(parent);
    if (!g.has(ca[i])) g.set(ca[i], []);
    g.get(ca[i]).push(cb[i]);
  }
  // names in order, the top (null) first
  const byName = (x, y) => {
    if (x === y) return 0;
    if (x === null || y === null) return x === null ? -1 : 1;
    return x < y ? -1 : 1;
  };
  const cycles = [];
  let found = 0;
  for (const parent of [...groups.keys()].sort(byName)) {
    const g = groups.get(parent);
    const names = [...new Set([...g.keys(), ...[...g.values()].flat()])].sort(byName);
    const id = new Map(names.map((p, k) => [p, k]));
    const adj = names.map((p) => (g.get(p) || []).map((q) => id.get(q)).sort((x, y) => x - y));
    const parts = components(adj).filter((p) => p.length > 1).map((p) => p.sort((x, y) => x - y)).sort((x, y) => x[0] - y[0]);
    for (const part of parts) {
      if (found++ >= MAX_CYCLES) continue;
      // the two-way pairs: both directions inside the group, each pair once, the earlier module first
      const out = new Set(), twoWay = [];
      for (const v of part) for (const w of adj[v]) out.add(`${v},${w}`);
      for (const v of part) for (const w of adj[v]) if (v < w && out.has(`${w},${v}`)) twoWay.push([names[v], names[w]]);
      cycles.push({
        parent, modules: part.slice(0, MAX_CYCLE_MODULES).map((x) => names[x]), moreModules: Math.max(0, part.length - MAX_CYCLE_MODULES),
        pairs: twoWay.slice(0, MAX_CYCLE_PAIRS), morePairs: Math.max(0, twoWay.length - MAX_CYCLE_PAIRS),
      });
    }
  }
  return { cycles, more: found - cycles.length };
}
