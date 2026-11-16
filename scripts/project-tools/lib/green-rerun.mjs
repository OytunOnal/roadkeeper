// @level infrastructure
// Roadkeeper — a red green's rerun: whether the tested tree's red run (green-stamp.mjs) may rerun its failed test files,
// and the line of a rerun that stamped the tree. It may when the tree has one, not yet rerun, whose test files failed,
// each a test file of the tree, none reaching the change: the files the tree changes against its merge base with the
// remote's default branch (landing.mjs's remoteHome, origin's default branch as _hook.mjs's `branches` says), their
// reader tests found as reader-tests finds them (reader-scan.mjs). Asks git, reads the red run and the failed files'
// text; writes and runs nothing.

import { branches } from "../../_hook.mjs";
import { gitWithin, shortHash } from "../../_git.mjs";
import { plural } from "../../_text.mjs";
import { listingLimit, shownName } from "./commit-tree.mjs";
import { redRun } from "./green-stamp.mjs";
import { remoteHome } from "./landing.mjs";
import { changedFiles } from "./near-stamp.mjs";
import { changeReaders } from "./reader-scan.mjs";
import { worktreeTests } from "./test-run.mjs";

const REMOTE = "origin"; // the remote whose default branch the change is found against
const NAMES_SHOWN = 10;  // the files a line names, the rest counted: a load-flaky red is a handful

// The files named on a line, the first NAMES_SHOWN shown safe, the rest counted.
const namesLine = (files) => {
  const shown = files.slice(0, NAMES_SHOWN).map(shownName).join(", ");
  return files.length > NAMES_SHOWN ? `${shown} and ${files.length - NAMES_SHOWN} more` : shown;
};

// The files the tree `tree` changes against its merge base with the remote's default branch, in the worktree at
// `root`: { changed }, or { refusal }, the line saying why they cannot be found.
function changeOf(root, tree) {
  const { home } = branches(root);
  const ref = remoteHome(root, REMOTE, home);
  if (!ref) return { refusal: `no remote default branch (${REMOTE}/${home}) to find the change against; a rerun needs one` };
  let base = "";
  try { base = gitWithin(["merge-base", ref, "HEAD"], root, { timeout: listingLimit(root) }); } catch { /* said below */ }
  const changed = base ? changedFiles(root, base, tree) : null;
  return changed ? { changed } : { refusal: `git could not say what this tree changes against ${ref}` };
}

// The line of a failed file reaching the change, naming the changed file it reaches or comes through.
const readerLine = (reader) => {
  const reached = reader.through ?? reader.reads?.[0];
  return `${shownName(reader.file)} failed and reaches the change${reached ? ` (${shownName(reached)})` : ""}; fix it, or ` +
    "run the whole green";
};

// The tested tree's red run when it may rerun: { red } (green-stamp.mjs's redRun), or { refusal }, the line saying why
// not. `run`: { root, main, tree, tests, recordedEdges }, the worktree, its main checkout, the tested tree, the tests'
// setup (test-run.mjs's testSetup; null: none) and the structure module's reading of structure.json's edges.
// The refusal of a red run already rerun, naming what its rerun failed: the test files, else the step.
function rerunRefusal({ date, failed, step }) {
  let what = "";
  if (failed.length) what = `: ${namesLine(failed)}`;
  else if (step) what = ` at ${shownName(step)}`;
  return `this tree's rerun of ${date} was red${what}; a rerun runs once: fix it, or run the whole green`;
}

// The refusal of a red run whose failed files reach the change, or null: a failed file the change edits; one the
// reader scan could not read; one reaching a changed file (reader-scan.mjs's changeReaders). `scope`: { root, red,
// changed, recordedEdges }.
function reachRefusal({ root, red, changed, recordedEdges }) {
  const edited = red.files.find((file) => changed.includes(file));
  if (edited !== undefined) return `${shownName(edited)} failed and the change edits it; fix it, or run the whole green`;
  const scan = changeReaders({ root, tests: red.files, changed, recordedEdges });
  if (scan.read < red.files.length) {
    const why = scan.said.find((line) => red.files.some((file) => line.startsWith(shownName(file)))) ?? "a file not read";
    return `a failed test file could not be read to tell whether it reaches the change (${why}); run the whole green`;
  }
  return scan.readers.length ? readerLine(scan.readers[0]) : null;
}

// The tested tree's red run when it may rerun: { red } (green-stamp.mjs's redRun), or { refusal }, the line saying why
// not. `run`: { root, main, tree, tests, recordedEdges }, the worktree, its main checkout, the tested tree, the tests'
// setup (test-run.mjs's testSetup; null: none) and the structure module's reading of structure.json's edges.
export function rerunnable({ root, main, tree, tests, recordedEdges }) {
  const red = tree ? redRun(main, tree) : null;
  if (!red) return { refusal: `no red run of this tree${tree ? ` (${shortHash(tree)})` : ""} is recorded; run the green` };
  if (red.rerun) return { refusal: rerunRefusal(red.rerun) };
  if (!red.files.length) {
    const step = red.step === null ? "a step" : shownName(red.step);
    return { refusal: `this tree's run of ${red.date} went red at ${step}, not on a test file; a rerun is for failed test files` };
  }
  const testFiles = new Set(tests ? worktreeTests(tests) : []);
  const stranger = red.files.find((file) => !testFiles.has(file));
  if (stranger !== undefined) return { refusal: `the red run names ${shownName(stranger)}, not a test file of this tree; run the green` };
  const change = changeOf(root, tree);
  if (change.refusal) return change;
  const refusal = reachRefusal({ root, red, changed: change.changed, recordedEdges });
  return refusal ? { refusal } : { red };
}

// The last line of a rerun that stamped the tree `tree`, naming its red run's date and files.
export const rerunStampedLine = (tree, red) => `green: stamped ${shortHash(tree)} after a rerun: ` +
  `${plural(red.files.length, "test file")} failed in the run of ${red.date} and passed alone: ${namesLine(red.files)}`;
