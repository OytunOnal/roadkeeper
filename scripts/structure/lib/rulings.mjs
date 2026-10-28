// @level domain
// Roadkeeper — the structure check: what in a project's declared structure breaks its own rules, and the structure report
// that says it. Pure: rulings takes structureModel's output (structure-model.mjs), today, the versions closed on the
// tracker and whether its snapshot was read, the reader's facts about the disk (diskFacts, disk-facts.mjs) and the
// version a stamp is about to write, and returns the violations, the debt and the report's lines; the callers read the
// files, the clock and the snapshot.
//
// The rules: skills/slice/references/structure.md: The shape, the template's Rules, Known debt.

import { MAX_DEPTH, SOURCE, closedVersions, globMatch, grouped, outward, pathAndParents, placed, printable, readerMessage, readsCode, reviewPointDue, underPath } from "./structure-model.mjs";

// a project declares a few test patterns and a few exceptions; past these the rest are counted unread, so the check's
// cost stays bounded by its input's size
export const MAX_TESTS = 20, MAX_EXCEPTIONS = 1000;
// the cyclic groups a report names: enough to see every tangle of a project; past it they are counted
export const MAX_CYCLES = 50;
// the modules a group's line names: a tangle's members at a glance; past it they are counted
const MAX_CYCLE_MODULES = 20;
// the two-way pairs listed under a group, where a fix starts; past it they are counted
const MAX_CYCLE_PAIRS = 20;
// the root files a root-files line names: enough to find the stray ones; past it they are counted
const MAX_ROOT_FILES_NAMED = 20;
// the words the check's line says a module with several root files in
const ROOT_FILES_WORDS = { atRoot: "source files at its root", rule: "a deep module has one entry" };
// the lines of each group a stamp hands the architecture walk: enough to rank, few enough to read, and a bound on the
// repository's text in its brief
const STAMP_SHOWN = 20;
// the note a check that may go without the tracker snapshot prints in its place
const UNJUDGED_NOTE = "note      no tracker snapshot read: version exceptions were not judged; run The Road";

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

// How many module files the test patterns take out of the dependency rule, so a pattern that swallows the code is seen:
// over `files`, the files on disk by module (the digest's walk), since structure.json's own lists are not in the
// digest; without it over those lists. The check prints it through here.
export function testsTaken(sm, files = null) {
  const isTest = testOf(sm.tests);
  let count = 0, tested = 0;
  const lists = files ? [...files.values()] : sm.modules.map((m) => m.files || []);
  for (const list of lists) for (const f of list) { count++; if (isTest(f)) tested++; }
  return { files: count, tested };
}

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

// The options a check judges under, built once from the caller's and handed down unchanged: `today`; the versions
// closed on the tracker snapshot, `snapshot` or null; whether a snapshot was read; `snapshotOptional`, whether a version
// exception with none is a note, not unread; `stamping`, the version a stamp is about to write, or null.
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
// - the cycles, and what was not read past the caps;
// - the structure report (GLOSSARY: Structure report), as `reportLines` below returns it.
// `facts` is diskFacts' object, null to judge no disk.
export function rulings(sm, facts = null, judging = judgingOptions()) {
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
  // a deep module has one entry (ADR 0005): several files at its root are one ruling naming them all, none the entry
  for (const m of sm.modules) {
    if (m.level == null) report({ kind: "no-level", grade: KINDS["no-level"], module: m.path });
    if (m.rootFiles.length > 1) report({ kind: "root-files", grade: KINDS["root-files"], module: m.path, files: [...m.rootFiles].sort() });
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
  // page counts it outside
  const edges = new Map();
  for (const e of sm.edges) {
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
  const check = { violations, debt, unread, cycles: c, edges, modules: moduleRecords(sm, edges, isTest), mixed };
  return { ...check, ...reportLines({ sm, facts }, check, judging) };
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

// The report's lines, in the check's words: { groups, lines, atop, diskUnread, failed }.
// - groups: each group's lines, uncut: hard, unread, notes, stale, judgements, cycles with their pairs, cyclesPast (the count
//   past MAX_CYCLES), debt, and under `stamping` coming and open; shallow; then the tests and ignored lines, or null;
// - lines: what the check prints: the groups in that order, each cut and the rest counted, then the verdict;
// - atop: the lines the Architecture tab opens on: the unread, the stale and the level-name judgements, each group cut
//   as the check cuts it;
// - diskUnread: the lines the disk gave: a missing folder, the digest bound, a root file off the walk;
// - failed: a hard, unread or stale line.
// Paths print through printable, a reader's message through readerMessage: the lines reach agents.
function reportLines({ sm, facts }, check, judging) {
  const { snapshotOptional, stamping } = judging;
  const { hard, judgements, levelNames } = violationLines(check.violations);
  const { debt, coming } = debtLines(check.debt, stamping);
  // a version exception the disk was judged for and no snapshot read
  const unjudged = Boolean(facts) && !judging.snapshotRead && sm.exceptions.some((x) => x.untilKind === "version");
  const d = diskLines(sm, facts), unread = [...modelUnread(sm, check, unjudged && !snapshotOptional), ...d.unread];
  const groups = {
    hard, unread, notes: unjudged && snapshotOptional ? [UNJUDGED_NOTE] : [], stale: d.stale, judgements, cycles: cycleLines(check.violations),
    // the groups past MAX_CYCLES, counted on a line of their own
    cyclesPast: check.cycles.more ? [`judgement cycle  ${check.cycles.more} more cycles past the first ${MAX_CYCLES}`] : [],
    debt, coming, open: stamping === null ? [] : openLines(check.modules),
    // past the digest bound the files are not compared, so none is said shallow
    shallow: facts && !facts.digest ? [] : shallowLines(check.modules), tests: d.tests, ignored: d.ignored,
  };
  const failed = [hard, unread, d.stale].some((g) => g.length > 0);
  const atop = [...grouped(unread), ...d.stale, ...grouped(levelNames)];
  return { groups, lines: printed(groups, stamping, failed), atop, diskUnread: d.disk, failed };
}

// What the check prints: each group cut, at STAMP_SHOWN under a stamp, and the rest counted (the unread and stale lines
// never cut by a stamp); the cycles after the judgements, a group of their own; the shallow? advisories; the tests and
// ignored counts; the verdict.
function printed(g, stamping, failed) {
  const cap = stamping === null ? undefined : STAMP_SHOWN;
  const lines = [...grouped(g.hard, cap), ...grouped(g.unread), ...g.notes, ...g.stale, ...grouped(g.judgements, cap), ...grouped(g.cycles, cap), ...g.cyclesPast,
    ...grouped(g.debt, cap), ...grouped(g.coming, cap), ...grouped(g.open, cap), ...grouped(g.shallow, cap)];
  for (const l of [g.tests, g.ignored]) if (l) lines.push(l);
  lines.push(failed ? "structure: violations" : "structure: clean");
  return lines;
}

// The unread lines the model gives: what its reader could not read, no modules, a version exception with no snapshot
// (`unjudged`), and the test patterns and exceptions past their caps.
function modelUnread(sm, check, unjudged) {
  const unread = sm.malformed.map((m) => `unread    ${readerMessage(m.where)} — ${readerMessage(m.what)}`);
  if (!readsCode(sm)) unread.push("unread    structure.json lists no modules and no files: rerun the structure command");
  if (unjudged) {
    unread.push("unread    docs/roadkeeper/issues.json is missing, not a snapshot, a link, or over its cap: no version can be read as closed; run The Road");
  }
  if (check.unread.tests) unread.push(`unread    ${check.unread.tests} test patterns past the first ${MAX_TESTS}`);
  if (check.unread.exceptions) unread.push(`unread    ${check.unread.exceptions} exceptions past the first ${MAX_EXCEPTIONS}`);
  return unread;
}

// Each violation but a cycle as a line, hard or judgement: a module's root files, a file without its level, a module
// without one, else an edge's ends; a due exception named. The level-name judgements also apart, for the tab.
function violationLines(violations) {
  const hard = [], judgements = [], levelNames = [];
  for (const v of violations) {
    if (v.kind === "cycle") continue;
    const due = v.exception ? ` — exception (dependency-rules.md:${v.exception.line}, ${printable(v.exception.until)}) is due` : "";
    const line = `${v.grade.padEnd(9)} ${v.kind}  ${describeWhere(v)}${due}`;
    (v.grade === "hard" ? hard : judgements).push(line);
    if (v.kind === "level-name") levelNames.push(line);
  }
  return { hard, judgements, levelNames };
}

// a module with several root files: each named from the module's folder, the first MAX_ROOT_FILES_NAMED and the rest
// counted
const rootFilesWhere = (v) => {
  const names = v.files.slice(0, MAX_ROOT_FILES_NAMED).map((f) => printable(f.slice(v.module.length + 1))).join(", ");
  const more = v.files.length > MAX_ROOT_FILES_NAMED ? ` and ${v.files.length - MAX_ROOT_FILES_NAMED} more` : "";
  return `${printable(v.module)} — ${v.files.length} ${ROOT_FILES_WORDS.atRoot}: ${names}${more}; ${ROOT_FILES_WORDS.rule}`;
};
// a file a violation names: a file of mixed levels with its levels, innermost first
const fileWhere = (v) => printable(v.file) + (v.levels ? ` (${v.levels.map((l) => printable(l)).join(", ")})` : "");
// where a ruling sits, as its line says it: root files, a file, a level named like a folder, a module, an edge's ends
const describeWhere = (v) => {
  if (v.files) return rootFilesWhere(v);
  if (v.file) return fileWhere(v);
  if (v.level) return `level ${printable(v.level)} is named like the folder of module ${printable(v.module)}`;
  return v.module && !v.from ? printable(v.module) : `${printable(v.from)} → ${printable(v.to)}`;
};

// A cycle: one line naming its group's modules, then its two-way pairs, each list cut and the rest counted.
function cycleLines(violations) {
  const lines = [];
  for (const v of violations) {
    if (v.kind !== "cycle") continue;
    lines.push(`judgement cycle  ${v.modules.map((m) => printable(m)).join(", ")}${v.moreModules ? ` and ${v.moreModules} more` : ""}`);
    for (const [a, b] of v.pairs) lines.push(`          pair  ${printable(a)} ↔ ${printable(b)}`);
    if (v.morePairs) lines.push(`          pair  and ${v.morePairs} more two-way pairs`);
  }
  return lines;
}

// The debt an exception still covers, and under a stamp what it makes due: an exception whose version it reaches,
// or passes; no day comes by a stamp.
function debtLines(covered, stamping) {
  const debt = [], coming = [];
  for (const v of covered) {
    const line = `${v.kind}  ${describeWhere(v)} — excepted until ${printable(v.exception.until)} (dependency-rules.md:${v.exception.line})`;
    const comes = stamping !== null && reviewPointDue(v.exception.until, null, [stamping]);
    if (comes) coming.push(`coming    ${line}`);
    else debt.push(`debt      ${line}`);
  }
  return { debt, coming };
}

// Each module reached from outside, most open first, as the page shows its record: the violations past its entry,
// its inner modules' files reached past it, and the files past its entry an exception not yet due covers.
function openLines(records) {
  const skipped = (m) => m.pastInterface + m.innerPast.length;
  const mods = [...records].filter(([, m]) => m.total && (m.reached || m.innerPast.length))
    .sort(([, a], [, b]) => b.reached / b.total - a.reached / a.total || skipped(b) - skipped(a));
  return mods.map(([p, m]) => {
    const inner = m.innerPast.length ? `, ${m.innerPast.length} of its inner modules' files past it` : "";
    const excepted = m.exceptedPast ? ` · ${m.exceptedPast} excepted` : "";
    return `open      ${printable(p)} — ${m.reached} of ${m.total} files reached from outside, ${m.pastInterface} past its entry${inner}${excepted}`;
  });
}

// An advisory, not a violation, for each module whose one file is its entry: it hides nothing (ADR 0004), likely a
// feature folder.
function shallowLines(records) {
  return [...records].filter(([, m]) => m.shallow).map(([p]) => `shallow?  ${printable(p)} — its one file is its entry, none private`);
}

// The lines the reader's facts give: { unread, stale, disk, tests, ignored }. Unread: a module with no plain folder, the
// digest bound, a root file off the walk. Stale: the digest of the files on disk is not the one the stamp wrote, or a
// module's `files`, or the files no module holds, is not the list on disk — the digest does not cover the lists, so
// they are compared apart. The tests line counts the files on disk, not the lists structure.json carries. No facts, or
// no code read: none.
function diskLines(sm, facts) {
  const out = { unread: [], stale: [], disk: [], tests: null, ignored: null };
  if (!facts || !readsCode(sm)) return out;
  const said = (line) => { out.unread.push(line); out.disk.push(line); };
  for (const m of facts.missing) said(`unread    module ${printable(m)} has no plain folder on disk`);
  if (!facts.digest) said(`unread    the modules could not be digested: ${readerMessage(facts.over)}`);
  const onDisk = new Map(Object.entries(facts.files)), stale = staleLine(sm, facts, onDisk);
  if (stale) out.stale.push(stale);
  if (facts.ignored.length) out.ignored = `ignored   ${facts.ignored.length} files match ## Ignore and are out of the digest`;
  if (!facts.digest) return out;
  for (const x of facts.offWalk) said(`unread    root file ${printable(x.file)} ${x.why}: an interface is never out of the digest`);
  const tested = testsTaken(sm, onDisk);
  if (tested.files) out.tests = `tests     ${tested.tested} of ${tested.files} module files match ## Tests and are out of the dependency rule`;
  return out;
}

// The one stale line, or null: no digest stamped, another digest, then a module's files list, then the files no module
// holds. Past the digest bound nothing is compared: the bound is an unread line.
function staleLine(sm, facts, onDisk) {
  if (!sm.digest) return "stale     structure.json carries no digest: rerun the structure command";
  if (!facts.digest) return null;
  if (facts.digest !== sm.digest) return "stale     the files are not the ones structure.json was stamped from: rerun the structure command";
  const differs = sm.modules.find((m) => (m.files || []).join("\n") !== (onDisk.get(m.path) || []).join("\n"));
  if (differs) return `stale     module ${printable(differs.path)} lists other files than its folder holds: rerun the structure command`;
  return sm.loose.join("\n") !== facts.loose.join("\n") ? "stale     structure.json lists other files no module holds than the disk has: rerun the structure command" : null;
}

// Each module's record, for every module, uncapped (the page cuts its own fold; the stamp's open lines count what they
// do not show): its files; the ones an edge from outside it and its nested modules reaches (outside every module
// counts); and its entry skips as the edges' rulings count them. Where the stamp listed the module's files only those
// count as reached or past its interface, so a graph cannot report more than the module holds; and `shallow`, whether
// its one listed file, tests aside, is its entry and no module nests in it.
function moduleRecords(sm, edges, isTest) {
  const parents = new Set(sm.modules.map((m) => m.parent));
  const shallow = (m) => {
    const own = (m.files || []).filter((f) => !isTest(f));
    return own.length === 1 && own[0] === m.entry && !parents.has(m.path);
  };
  const reached = new Map();
  for (const e of sm.edges) {
    if (e.fromModule && underPath(e.fromModule, e.toModule)) continue;
    if (!reached.has(e.toModule)) reached.set(e.toModule, new Set());
    reached.get(e.toModule).add(e.to);
  }
  const skips = entrySkips(edges), out = new Map();
  for (const m of sm.modules) {
    const sk = skips.get(m.path) || noSkips();
    const listed = m.files && m.files.length ? new Set(m.files) : null;
    const held = (s) => (listed ? [...s].filter((f) => listed.has(f)).length : s.size);
    out.set(m.path, {
      total: listed ? m.files.length : null, reached: held(reached.get(m.path) || new Set()),
      pastInterface: held(sk.past), innerPast: [...sk.inner].sort(), exceptedPast: sk.excepted.size, testsPast: sk.tests.size,
      shallow: shallow(m),
    });
  }
  return out;
}

const noSkips = () => ({ past: new Set(), inner: new Set(), excepted: new Set(), tests: new Set() });

// A module's entry-skipping edges as the check rules them, each counted at the outermost module it reaches past
// the entry of: the files of its own a violation reaches past an entry, apart the files of its inner modules, the ones an
// exception not yet due covers, and the ones a test reaches past the interface.
function entrySkips(checked) {
  const out = new Map();
  const at = (p) => { if (!out.has(p)) out.set(p, noSkips()); return out.get(p); };
  for (const e of checked.values()) {
    if (e.rulings.has("test-past-interface")) at(e.skipped).tests.add(e.to);
    if (!e.rulings.has("past-entry")) continue;
    const sk = at(e.skipped);
    if (e.rulings.has("excepted")) sk.excepted.add(e.to);
    else (e.toModule === e.skipped ? sk.past : sk.inner).add(e.to);
  }
  return out;
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
// siblings under the deepest module holding both — a parent and its child are no pair; a test's edge is no dependency.
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
    if (!e.fromModule || !e.toModule || e.fromModule === e.toModule || isTest(e.from)) continue;
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
