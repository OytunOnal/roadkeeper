// @level domain
// Roadkeeper — test cases read by name, as the tools show them: a crashed file's made unknown, counted, listed by file,
// and compared between two trees.
// A case is its file and its id; its outcomes are every outcome its id took in its file, in order, so a case run over
// several inputs compares as a list; an unknown case always differs. An id gone from one file and new in another, once
// among each tree's unmatched cases, is a moved case, compared across its files. Text from the run is shown with its
// controls replaced, cut.

import { controlsReplaced, cutAt, plural } from "../../_text.mjs";

const NAME_SHOWN = 300;   // characters of a file's or a case's name shown
const DETAIL_SHOWN = 600; // characters of a failing case's detail shown, as tests/_case.py shows it
const DETAIL_INDENT = "      "; // under its case line, deeper than any case line
const SEPARATOR = "\u0000"; // between a case's file and id in its key: no name read holds one
const UNKNOWN = "UNKNOWN"; // a crashed file's case's outcome: nothing proves it
const OUTCOMES_WITH_DETAIL = new Set(["FAIL", "SKIP"]); // the outcomes whose detail shows under their case

const shown = (text) => cutAt(controlsReplaced(text), NAME_SHOWN);
const order = new Intl.Collator("en", { numeric: true }).compare; // A2 before A10

// The counts of the cases' outcomes, as a line's end; the unknown only when there is one.
export function counted(cases) {
  const of = (outcome) => cases.filter((c) => c.outcome === outcome).length;
  const unknown = of(UNKNOWN) ? `, ${of(UNKNOWN)} unknown` : "";
  return `${plural(cases.length, "case")}, ${of("PASS")} pass, ${of("FAIL")} fail, ${of("SKIP")} skip${unknown}`;
}

// The crashed files of one run given `files`, each to its crash's first line; empty when the run did not crash. A
// failing case of no file given is a crash; it crashes each file the run read a case from whose path, `/` or `\`
// between its parts, its detail or text holds (an absolute path in the run's tree holds it too), or every file when it
// holds none. A file crashed twice keeps the first crash.
export function crashedFiles(cases, files) {
  const crashOf = new Map();
  const read = files.filter((f) => cases.some((c) => c.file === f));
  for (const crash of cases.filter((c) => c.outcome === "FAIL" && !files.includes(c.file))) {
    const crashText = `${crash.detail}\n${crash.text}`;
    const named = read.filter((f) => crashText.includes(f) || crashText.includes(f.replaceAll("/", "\\")));
    for (const file of named.length ? named : files) if (!crashOf.has(file)) crashOf.set(file, crash.detail.split("\n")[0]);
  }
  return crashOf;
}

// The cases, each of a file `crashOf` holds UNKNOWN, its detail that file's crash.
export const unknownMarked = (cases, crashOf) =>
  cases.map((c) => (crashOf.has(c.file) ? { ...c, outcome: UNKNOWN, detail: crashOf.get(c.file) } : c));

// A case's lines: its outcome and name, then a failing or skipped case's detail.
function caseLines(c) {
  const showsDetail = OUTCOMES_WITH_DETAIL.has(c.outcome) && c.detail;
  const detail = showsDetail ? c.detail.slice(0, DETAIL_SHOWN).split("\n") : [];
  return [`  ${c.outcome} ${shown(c.name)}`, ...detail.map((l) => DETAIL_INDENT + controlsReplaced(l))];
}

// A file's line: its name, and the crash its cases are unknown by.
function fileLine(file, inFile) {
  const crashed = inFile.find((c) => c.outcome === UNKNOWN);
  const name = shown(file) || "(no file named)";
  return crashed ? `${name}: crashed, its cases unknown: ${controlsReplaced(crashed.detail.slice(0, DETAIL_SHOWN))}` : name;
}

// The cases' lines, under their files' lines in the order each file came first.
export function listedByFile(cases) {
  const byFile = new Map();
  for (const c of cases) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file).push(c);
  }
  return [...byFile].flatMap(([file, inFile]) => [fileLine(file, inFile), ...inFile.flatMap(caseLines)]);
}

// Each case's outcomes by its key: { file, id, outcomes }.
function outcomesByCase(cases) {
  const found = new Map();
  for (const { file, id, outcome } of cases) {
    const key = file + SEPARATOR + id;
    if (!found.has(key)) found.set(key, { file, id, outcomes: [] });
    found.get(key).outcomes.push(outcome);
  }
  return found;
}

// The ids among these unmatched cases that only one holds.
function once(unmatched) {
  const seen = new Map();
  for (const c of unmatched) seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
  return new Map(unmatched.filter((c) => seen.get(c.id) === 1).map((c) => [c.id, c]));
}

// Each moved case: the base's key to today's case.
function moves(base, today) {
  const gone = once([...base].filter(([k]) => !today.has(k)).map(([, c]) => c));
  const landed = once([...today].filter(([k]) => !base.has(k)).map(([, c]) => c));
  return new Map([...gone].filter(([id]) => landed.has(id)).map(([id, c]) => [c.file + SEPARATOR + id, landed.get(id)]));
}

const said = (outcomes) => outcomes.join(" ") || "none";

// Whether a case's outcomes differ between the base and today: an unknown one on either tree always does, since
// nothing proves it the same.
const differs = (was, now) => said(was.outcomes) !== said(now.outcomes) || [...was.outcomes, ...now.outcomes].includes(UNKNOWN);

// The line naming a case whose outcomes differ between the base and today.
function differenceLine(was, now) {
  const files = was.file === now.file ? was.file : `${was.file} -> ${now.file}`;
  const named = [files, was.id].filter(Boolean).map(shown).join(" ");
  return `${named}: base ${said(was.outcomes)}, working tree ${said(now.outcomes)}`;
}

// The lines naming each case whose outcomes differ between the base's cases and today's: in its outcomes, in one tree
// only, or in how often it ran, or unknown on either; file by file, id by id.
export function differences(baseCases, todayCases) {
  const base = outcomesByCase(baseCases), today = outcomesByCase(todayCases);
  const moved = moves(base, today);
  const landed = new Set([...moved.values()].map((c) => c.file + SEPARATOR + c.id));
  const keys = [...new Set([...base.keys(), ...today.keys()])].filter((k) => !landed.has(k));
  const cases = keys.map((k) => {
    const was = base.get(k) ?? { ...today.get(k), outcomes: [] };
    return [was, moved.get(k) ?? today.get(k) ?? { ...was, outcomes: [] }];
  });
  const sorted = cases.sort(([a], [b]) => order(a.file, b.file) || order(a.id, b.id));
  return sorted.filter(([was, now]) => differs(was, now)).map(([was, now]) => differenceLine(was, now));
}
