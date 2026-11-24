// @level presentation
// Roadkeeper — test cases' lines, as the tools show them (case-outcomes.mjs): their outcomes counted, listed by file,
// and a changed case named with why on each tree it failed, went unknown or was skipped. Text from the run is shown with
// its controls replaced, cut.

import { controlsReplaced, cutAt, plural, readerLines } from "../../_text.mjs";
import { OUTCOMES_WITH_DETAIL, UNKNOWN, outcomesOf } from "./case-outcomes.mjs";

const NAME_SHOWN = 300;   // characters of a file's or a case's name shown
const REASON_SHOWN = 300; // characters of a changed case's reason shown: one line under its case's line
const DETAIL_SHOWN = 600; // characters of a failing case's detail shown, as tests/_case.py shows it
const DETAIL_INDENT = "      "; // under its case line, deeper than any case line

const shown = (text) => cutAt(controlsReplaced(text), NAME_SHOWN);

// The counts of the cases' outcomes, as a line's end; the unknown only when there is one.
export function counted(cases) {
  const of = (outcome) => cases.filter((c) => c.outcome === outcome).length;
  const unknown = of(UNKNOWN) ? `, ${of(UNKNOWN)} unknown` : "";
  return `${plural(cases.length, "case")}, ${of("PASS")} pass, ${of("FAIL")} fail, ${of("SKIP")} skip${unknown}`;
}

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

const said = (outcomes) => outcomes.join(" ") || "none";

// The line naming a case whose outcomes differ between the base and today.
function differenceLine(was, now) {
  const files = was.file === now.file ? was.file : `${was.file} -> ${now.file}`;
  const named = [files, was.id].filter(Boolean).map(shown).join(" ");
  return `${named}: base ${said(outcomesOf(was))}, working tree ${said(outcomesOf(now))}`;
}

// A tree's reason for a case, shown on one line: its first failed, unknown or skipped outcome's, blank lines dropped,
// line breaks read as spaces, controls replaced, cut, the cut's end trimmed; "" for none.
function treeReason(entry) {
  const first = entry.runs.find((run) => run.reason !== null)?.reason ?? "";
  return cutAt(controlsReplaced(readerLines(first).filter((l) => l.trim()).join(" ")), REASON_SHOWN).trimEnd();
}

// The lines under a changed case saying why, a tree's each led by its name; one led by `both trees` when they agree.
function reasonLines(was, now) {
  const baseReason = treeReason(was), todayReason = treeReason(now);
  if (baseReason && baseReason === todayReason) return [`${DETAIL_INDENT}both trees: ${baseReason}`];
  const byTree = [["base", baseReason], ["working tree", todayReason]].filter(([, reason]) => reason);
  return byTree.map(([tree, reason]) => `${DETAIL_INDENT}${tree}: ${reason}`);
}

// A changed case's lines (case-outcomes.mjs's changedCases, [was, now]): its line naming it, then why on each tree.
export const differenceLines = ([was, now]) => [differenceLine(was, now), ...reasonLines(was, now)];
