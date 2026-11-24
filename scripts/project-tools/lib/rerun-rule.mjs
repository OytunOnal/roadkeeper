// @level domain
// Roadkeeper — when a red green may rerun its failed test files: the tested tree has a red run, not yet rerun, whose
// test files failed, each a test file of the tree, none reaching the change; and the line of a rerun that stamped the
// tree.

import { plural } from "../../_text.mjs";
import { shownName } from "./shown-name.mjs";

const NAMES_SHOWN = 10;  // the files a line names, the rest counted: a load-flaky red is a handful

// The files named on a line, the first NAMES_SHOWN shown safe, the rest counted.
const namesLine = (files) => {
  const shown = files.slice(0, NAMES_SHOWN).map(shownName).join(", ");
  return files.length > NAMES_SHOWN ? `${shown} and ${files.length - NAMES_SHOWN} more` : shown;
};

// The line of a failed file reaching the change, naming the changed file it reaches or comes through.
const readerLine = (reader) => {
  const reached = reader.through ?? reader.reads?.[0];
  return `${shownName(reader.file)} failed and reaches the change${reached ? ` (${shownName(reached)})` : ""}; fix it, or ` +
    "run the whole green";
};

// The refusal of a red run already rerun, naming what its rerun failed: the test files, else the step.
function rerunRefusal({ date, failed, step }) {
  let what = "";
  if (failed.length) what = `: ${namesLine(failed)}`;
  else if (step) what = ` at ${shownName(step)}`;
  return `this tree's rerun of ${date} was red${what}; a rerun runs once: fix it, or run the whole green`;
}

// The refusal of a red run whose failed files reach the change, or null: a failed file the change edits; one the
// reader scan could not read; one reaching a changed file. `red`: the red run; `changed`: the files the change touches;
// `readers(files, changed)`: the reader scan of the failed files against the change, { read, readers, said }, asked
// only when no failed file is edited.
export function reachRefusal(red, changed, readers) {
  const edited = red.files.find((file) => changed.includes(file));
  if (edited !== undefined) return `${shownName(edited)} failed and the change edits it; fix it, or run the whole green`;
  const scan = readers(red.files, changed);
  if (scan.read < red.files.length) {
    const why = scan.said.find((line) => red.files.some((file) => line.startsWith(shownName(file)))) ?? "a file not read";
    return `a failed test file could not be read to tell whether it reaches the change (${why}); run the whole green`;
  }
  return scan.readers.length ? readerLine(scan.readers[0]) : null;
}

// The tested tree's red run when it may rerun: { red }, or { refusal }, the line saying why not. `facts`: { red,
// shortTree, testFiles(), change(), readers(files, changed) }, the tree's red run (null: none recorded), the tree as a
// line shows it ("" when there is none), the tree's test files, the change, { changed } or { refusal }, and the reader
// scan (reachRefusal's), each asked only when the rule needs it.
export function rerunnable({ red, shortTree, testFiles, change, readers }) {
  if (!red) return { refusal: `no red run of this tree${shortTree ? ` (${shortTree})` : ""} is recorded; run the green` };
  if (red.rerun) return { refusal: rerunRefusal(red.rerun) };
  if (!red.files.length) {
    const step = red.step === null ? "a step" : shownName(red.step);
    return { refusal: `this tree's run of ${red.date} went red at ${step}, not on a test file; a rerun is for failed test files` };
  }
  const isTestFile = new Set(testFiles());
  const stranger = red.files.find((file) => !isTestFile.has(file));
  if (stranger !== undefined) return { refusal: `the red run names ${shownName(stranger)}, not a test file of this tree; run the green` };
  const found = change();
  if (found.refusal) return found;
  const refusal = reachRefusal(red, found.changed, readers);
  return refusal ? { refusal } : { red };
}

// The last line of a rerun that stamped the tree, `shortTree` as a line shows it, naming its red run's date and files.
export const rerunStampedLine = (shortTree, red) => `green: stamped ${shortTree} after a rerun: ` +
  `${plural(red.files.length, "test file")} failed in the run of ${red.date} and passed alone: ${namesLine(red.files)}`;
