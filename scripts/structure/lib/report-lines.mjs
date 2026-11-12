// @level domain
// Roadkeeper — the structure report's lines (GLOSSARY: Structure report): what the check prints, the lines the
// Architecture tab opens on and the lines the disk gave, in the check's words. Pure: reportLines takes structureModel's
// output (structure-model.mjs), the reader's facts about the disk (diskFacts, disk-facts.mjs), the rulings' check
// (rulings.mjs) and the options it judged under, and returns the lines; diskLines, the disk's lines alone, for the
// stamp. The callers read the files, the clock and the snapshot.

import { reviewPointDue } from "./review-points.mjs";
import { grouped, printable, readerMessage } from "./printable.mjs";
import { readsCode } from "./structure-model.mjs";
import { codeFiles, moduleCountWords } from "./module-records.mjs";
import { MAX_CYCLES, MAX_EXCEPTIONS, MAX_TESTS, testOf } from "./rulings.mjs";

// the root files a root-files line names: enough to find the stray ones; past it they are counted
const MAX_ROOT_FILES_NAMED = 20;
// the words the check's line says a module with several root files in
const ROOT_FILES_WORDS = { atRoot: "source files at its root", rule: "a deep module has one entry" };
// the lines of each group a stamp hands the architecture walk: enough to rank, few enough to read, and a bound on the
// repository's text in its brief
const STAMP_SHOWN = 20;
// the note a check that may go without the tracker snapshot prints in its place
const UNJUDGED_NOTE = "note      no tracker snapshot read: version exceptions were not judged; run The Road";

// How many module files the test patterns take out of the dependency rule, so a pattern that swallows the code is seen:
// over `files`, the files on disk by module (the digest's walk), since structure.json's own lists are not in the
// digest; without it over those lists. The check prints it through here.
export function testsTaken(sm, files = null) {
  const isTest = testOf(sm.tests);
  let count = 0, tested = 0;
  const lists = files ? [...files.values()] : sm.modules.map((m) => m.files || []);
  // a module's code files only (SOURCE): a stylesheet or a data file is out of the rule without a pattern
  for (const f of codeFiles(lists.flat()) || []) { count++; if (isTest(f)) tested++; }
  return { files: count, tested };
}

// The report's lines, in the check's words: { lines, atop, diskUnread, failed }.
// - lines: what the check prints: hard, unread, notes, stale, judgements, cycles with their pairs, cyclesPast (the count
//   past MAX_CYCLES), debt, and under `stamping` coming and open; shallow; each group cut and the rest counted; then the
//   tests and ignored lines, and the verdict;
// - atop: the lines the Architecture tab opens on: the unread, the stale and the level-name judgements, each group cut
//   as the check cuts it;
// - diskUnread: the lines the disk gave: a missing folder, the digest bound, a root file off the walk;
// - failed: a hard, unread or stale line.
// Paths print through printable, a reader's message through readerMessage: the lines reach agents.
export function reportLines({ sm, facts }, check, judging) {
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
  return { lines: printed(groups, stamping, failed), atop, diskUnread: d.disk, failed };
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

// Each module reached from outside, most open first, in the page's words (moduleCountWords), the paths in them
// printable, then its inner modules' files reached past it: after a comma, or, with none of its own files reached, as
// the way in, after a " · ".
function openLines(records) {
  const skipped = (m) => m.pastInterface + m.innerPast.length;
  const mods = [...records].filter(([, m]) => m.total && (m.reached || m.innerPast.length))
    .sort(([, a], [, b]) => b.reached / b.total - a.reached / a.total || skipped(b) - skipped(a));
  return mods.map(([p, m]) => {
    const inner = m.innerPast.length ? `${m.reached ? "," : " ·"} ${m.innerPast.length} of its inner modules' files past it` : "";
    return `open      ${printable(p)} — ${moduleCountWords(m, printable)}${inner}`;
  });
}

// An advisory, not a violation, for each module whose one code file is its entry: it hides nothing (ADR 0004), likely a
// feature folder.
function shallowLines(records) {
  return [...records].filter(([, m]) => m.shallow).map(([p]) => `shallow?  ${printable(p)} — its one code file is its entry, none private`);
}

// The lines the reader's facts give: { unread, stale, disk, tests, ignored }. Unread: a module with no plain folder, the
// digest bound, a root file off the walk. Stale: the digest of the files on disk is not the one the stamp wrote, or a
// module's `files`, or the files no module holds, is not the list on disk — the digest does not cover the lists, so
// they are compared apart. The tests line counts the files on disk, not the lists structure.json carries. No facts, or
// no code read: none.
export function diskLines(sm, facts) {
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
