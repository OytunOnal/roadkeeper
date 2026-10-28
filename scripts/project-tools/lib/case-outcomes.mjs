// @level domain
// Roadkeeper — test cases read by name, as the tools show them: counted, listed by file, and compared between two trees.
// A case is its file and its id; its outcomes are every outcome its id took in its file, in order, so a case run over
// several inputs compares as a list. An id gone from one file and new in another, once among each tree's unmatched
// cases, is a moved case, compared across its files. Text from the run is shown with its controls replaced, cut.

import { controlsReplaced, cutAt, plural } from "../../_text.mjs";

const NAME_SHOWN = 300;   // characters of a file's or a case's name shown
const DETAIL_SHOWN = 600; // characters of a failing case's detail shown, as tests/_case.py shows it
const DETAIL_INDENT = "      "; // under its case line, deeper than any case line
const SEPARATOR = "\u0000"; // between a case's file and id in its key: no name read holds one

const shown = (text) => cutAt(controlsReplaced(text), NAME_SHOWN);
const order = new Intl.Collator("en", { numeric: true }).compare; // A2 before A10

// The counts of the cases' outcomes, as a line's end.
export function counted(cases) {
  const of = (outcome) => cases.filter((c) => c.outcome === outcome).length;
  return `${plural(cases.length, "case")}, ${of("PASS")} pass, ${of("FAIL")} fail, ${of("SKIP")} skip`;
}

// A case's lines: its outcome and name, then a failing or skipped case's detail.
function caseLines(c) {
  const detail = c.outcome !== "PASS" && c.detail ? c.detail.slice(0, DETAIL_SHOWN).split("\n") : [];
  return [`  ${c.outcome} ${shown(c.name)}`, ...detail.map((l) => DETAIL_INDENT + controlsReplaced(l))];
}

// The cases' lines, under their files' names in the order each file came first.
export function listedByFile(cases) {
  const byFile = new Map();
  for (const c of cases) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file).push(c);
  }
  return [...byFile].flatMap(([file, inFile]) => [shown(file) || "(no file named)", ...inFile.flatMap(caseLines)]);
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

// The line naming a case whose outcomes differ between the base and today.
function differenceLine(was, now) {
  const files = was.file === now.file ? was.file : `${was.file} -> ${now.file}`;
  const named = [files, was.id].filter(Boolean).map(shown).join(" ");
  return `${named}: base ${said(was.outcomes)}, working tree ${said(now.outcomes)}`;
}

// The lines naming each case whose outcomes differ between the base's cases and today's: in its outcomes, in one tree
// only, or in how often it ran; file by file, id by id.
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
  return sorted.filter(([was, now]) => said(was.outcomes) !== said(now.outcomes)).map(([was, now]) => differenceLine(was, now));
}
