// @level presentation
// Roadkeeper — the structure report's lines (GLOSSARY: Structure report): what the check prints, the lines the
// Architecture tab opens on and the lines the disk gave, in the check's words. Pure: reportLines takes structureModel's
// output (structure-model.mjs), the reader's facts about the disk (diskFacts, disk-facts.mjs), the rulings' check
// (rulings.mjs) and the options it judged under, and returns the lines; diskLines, the disk's lines alone, for the
// stamp. What is stale, the verdict and the tests taken are report-findings.mjs's. The callers read the files, the clock
// and the snapshot.

import { reviewPointDue } from "./review-points.mjs";
import { printable, readerMessage } from "./printable.mjs";
import { GROUP, grouped } from "./cut-lines.mjs";
import { STRUCTURE_CAP, readsCode } from "./structure-model.mjs";
import { moduleCountWords } from "./module-count-words.mjs";
import { MAX_CYCLES, MAX_EXCEPTIONS, MAX_TESTS } from "./rulings.mjs";
import { staleFinding, testsTaken, verdictOf } from "./report-findings.mjs";
import { RULE, purityRulings } from "./inner-levels-pure.mjs";
import { plural } from "../../_text.mjs";

// the line a check or a plan prints when a structure file is not read: it judges nothing past it
export const STRUCTURE_UNREAD = `unread    docs/roadkeeper/dependency-rules.md or structure.json is missing, a link, or over the ${STRUCTURE_CAP / 1024 / 1024} MB cap`;

// the first line of the purity refusal: the step that fixes it, the breaches under it
const PURITY_STEP = `hard      ${RULE}  move each import and call below into an infrastructure or main file that hands its result in: a kernel, domain or application file does no I/O`;

// the root files a root-files line names: enough to find the stray ones; past it they are counted
const MAX_ROOT_FILES_NAMED = 20;
// the words the check's line says a module with several root files in
const ROOT_FILES_WORDS = { atRoot: "source files at its root", rule: "a deep module has one entry" };
// the lines of each group a stamp hands the architecture walk: enough to rank, few enough to read, and a bound on the
// repository's text in its brief
const STAMP_SHOWN = 20;
// the note a check that may go without the tracker snapshot prints in its place
const UNJUDGED_NOTE = "note      no tracker snapshot read: version exceptions were not judged; run The Road";
// how a stale line ends: the step, where the project names the structure command
const RESTAMP = "rerun the structure command your CODING_STANDARDS.md names under Commands";
// what each judgement kind asks, said once above its lines
const ASKS = {
  "level-name": "a level is named like a module's folder, though levels are layers, not folders; the review keeps it or renames the level",
  "cycle": "these modules reach each other round a loop; the review keeps it or cuts one of the two-way pairs under it",
};
const buildAsksLine = (kind) => `asks      ${kind} — ${ASKS[kind]}`;

// The report's lines, in the check's words: { lines, atop, diskUnread, failed }.
// - lines: what the check prints: hard (the purity refusal first), unread, notes, stale, judgements, cycles with their pairs, cyclesPast (the count
//   past MAX_CYCLES), debt, and under `stamping` coming and open; shallow; each group cut and the rest counted; then the
//   tests and ignored lines, and the verdict: stale when the stale lines are all that fails;
// - atop: the lines the Architecture tab opens on: the unread, the stale and the level-name judgements under their asks
//   line, each group cut as the check cuts it;
// - diskUnread: the lines the disk gave: a missing folder, the digest bound, a root file off the walk;
// - failed: a hard, unread or stale line.
// Paths print through printable, a reader's message through readerMessage: the lines reach agents.
export function reportLines({ sm, facts }, check, judging) {
  const { snapshotOptional, stamping } = judging;
  const purity = purityLines(sm), { judgements, levelNames, ...ruled } = violationLines(check.violations);
  const owed = debtLines(check.debt, stamping), hard = [...purity.hard, ...ruled.hard], debt = [...owed.debt, ...purity.debt];
  // a version exception the disk was judged for and no snapshot read
  const unjudged = Boolean(facts) && !judging.snapshotRead && sm.exceptions.some((x) => x.untilKind === "version");
  const d = diskLines(sm, facts), unread = [...modelUnread(sm, check, unjudged && !snapshotOptional), ...d.unread];
  const groups = {
    hard, unread, notes: unjudged && snapshotOptional ? [UNJUDGED_NOTE] : [], stale: d.stale, judgements, cycles: cycleLines(check.violations),
    // the groups past MAX_CYCLES, counted on a line of their own
    cyclesPast: check.cycles.more ? [`judgement cycle  ${check.cycles.more} more cycles past the first ${MAX_CYCLES}`] : [],
    debt, coming: owed.coming, open: stamping === null ? [] : openLines(check.modules),
    // past the digest bound the files are not compared, so none is said shallow
    shallow: facts && !facts.digest ? [] : shallowLines(check.modules), tests: d.tests, ignored: d.ignored,
  };
  const verdict = verdictOf({ hard: hard.length > 0, unread: unread.length > 0, stale: d.stale.length > 0 });
  const atop = [...grouped(unread), ...d.stale, ...placeAsksLines(levelNames)];
  return { lines: printed(groups, stamping, `structure: ${verdict}`), atop, diskUnread: d.disk, failed: verdict !== "clean" };
}

// Judgement lines, each { kind, line }, a kind's lines together in the order the kinds come, each kind's first line
// under its asks line; the judgement lines cut at `cap` and the rest counted, the asks lines not counted.
function placeAsksLines(judgements, cap = GROUP) {
  const kinds = [...new Set(judgements.map((j) => j.kind))];
  const ordered = kinds.flatMap((k) => judgements.filter((j) => j.kind === k));
  const firstOfKind = (i) => i < cap && i < ordered.length && (i === 0 || ordered[i].kind !== ordered[i - 1].kind);
  return grouped(ordered.map((j) => j.line), cap).flatMap((line, i) => firstOfKind(i) ? [buildAsksLine(ordered[i].kind), line] : [line]);
}

// What the check prints: each group cut, at STAMP_SHOWN under a stamp, and the rest counted (the unread and stale lines
// never cut by a stamp); the judgements under their asks lines; the cycles after them, a group of their own under the
// cycle's asks line; the shallow? advisories; the tests and ignored counts; the verdict.
function printed(g, stamping, verdictLine) {
  const cap = stamping === null ? undefined : STAMP_SHOWN;
  const cycles = g.cycles.length ? [buildAsksLine("cycle"), ...grouped(g.cycles, cap)] : [];
  const lines = [...grouped(g.hard, cap), ...grouped(g.unread), ...g.notes, ...g.stale, ...placeAsksLines(g.judgements, cap), ...cycles, ...g.cyclesPast,
    ...grouped(g.debt, cap), ...grouped(g.coming, cap), ...grouped(g.open, cap), ...grouped(g.shallow, cap)];
  for (const l of [g.tests, g.ignored]) if (l) lines.push(l);
  lines.push(verdictLine);
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
// without one, else an edge's ends; a due exception named. A judgement as { kind, line }; the level-name judgements
// also apart, for the tab.
function violationLines(violations) {
  const hard = [], judgements = [], levelNames = [];
  for (const v of violations) {
    if (v.kind === "cycle") continue;
    const due = v.exception ? ` — exception (dependency-rules.md:${v.exception.line}, ${printable(v.exception.until)}) is due` : "";
    const line = `${v.grade.padEnd(9)} ${v.kind}  ${describeWhere(v)}${due}`;
    if (v.grade === "hard") hard.push(line);
    else judgements.push({ kind: v.kind, line });
    if (v.kind === "level-name") levelNames.push({ kind: v.kind, line });
  }
  return { hard, judgements, levelNames };
}

// The purity rulings' lines (inner-levels-pure.mjs): { hard, debt }. Hard: with a breach outside the baseline, the
// line saying the step, then each breach, its file, line and what it imports or calls; debt: each baselined file
// with its count of breaches.
function purityLines(sm) {
  const { refused, kept } = purityRulings(sm);
  const found = refused.map((b) => `          ${RULE}  ${printable(b.file)}:${b.line} ${b.uses} ${printable(b.name)}`);
  return {
    hard: found.length ? [PURITY_STEP, ...found] : [],
    debt: kept.map((k) => `debt      ${RULE}  ${printable(k.file)} — ${plural(k.count, "breach", "breaches")} kept in structure.json's impureBaseline until fixed`),
  };
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

// what each stale finding (report-findings.mjs, staleFinding) says, before the step
const STALE_WORDS = {
  unstamped: () => "structure.json carries no digest",
  digest: () => "the files are not the ones structure.json was stamped from",
  module: (f) => `module ${printable(f.path)} lists other files than its folder holds`,
  loose: () => "structure.json lists other files no module holds than the disk has",
};
// The one stale line, or null: the stale finding said, then the step.
function staleLine(sm, facts, onDisk) {
  const found = staleFinding(sm, facts, onDisk);
  return found ? `stale     ${STALE_WORDS[found.kind](found)}: ${RESTAMP}` : null;
}
