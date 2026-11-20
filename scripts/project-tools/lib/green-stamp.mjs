// @level infrastructure
// Roadkeeper — the green stamp: a record per tree that ran green, in .run/green-stamp/ of the clone's main checkout, shared
// by every worktree of the clone; and beside it, in .run/green-red/, a record per tree whose green went red, its red run.
// A record is the tree's hash as its name, holding the tree and the date; a stamp after a rerun also the red run's date
// and the files rerun; a red run the test files that failed, or the step that went red, and its rerun once run. .run/,
// its folders and each record are read and written only when no link and the user's own; a record is written beside
// itself and renamed into place, and only where git ignores it, so a record never dirties the tree it names. The newest
// RECORDS_KEPT of each folder are kept.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { OBJECT_HASH as TREE_HASH } from "../../_git.mjs";
import { readPlainFile, replaceFile } from "../../_files.mjs";
import { RECORDS_KEPT, RUN_DIR, dropOldestEntries, isDate, isIgnored, isOwn, isRecordOfTree, listNewestEntries, madeFolder, now,
  ownFolder, recordFolder } from "./record-folder.mjs";

const STAMP_DIR = "green-stamp";   // the green stamp's folder in RUN_DIR
const RED_DIR = "green-red";       // the red runs' folder in RUN_DIR: never the stamp's, whose reader takes any record there
const RECORD_MAX = 64 * 1024;      // bytes read from a record: a tree's hash, dates and a red run's file names

const isFile = (st) => st.isFile(); // a record of the green stamp or a red run is a file

const isNames = (value) => Array.isArray(value) && value.every((name) => typeof name === "string");

// The tree's record in the checkout's folder `dir`, its fields; null when there is none, or it is a link, not the
// user's, over its cap, or not a record of that tree with a printable date.
function treeRecord(checkout, dir, tree) {
  const folder = TREE_HASH.test(tree) ? recordFolder(checkout, dir, ownFolder) : null;
  if (!folder) return null;
  const path = join(folder, tree);
  try { if (!isOwn(lstatSync(path))) return null; } catch { return null; }
  let fields;
  try { fields = JSON.parse(readPlainFile(path, RECORD_MAX)); } catch { return null; }
  return isRecordOfTree(fields, tree) && isDate(fields.date) ? fields : null;
}

// The tree's record in the checkout's green stamp, { date }; null when there is none, or it is a link, not the user's,
// over its cap or not a record of that tree.
export function stampedRecord(checkout, tree) {
  const fields = treeRecord(checkout, STAMP_DIR, tree);
  return fields ? { date: fields.date } : null;
}

// Writes the tree's record, its `fields` after the tree, into the checkout's folder `dir`, then drops the oldest there:
// whether it was written. Nothing is written where git does not ignore the record's path, nor through a link.
function writeRecord({ checkout, dir }, tree, fields) {
  if (!TREE_HASH.test(tree) || !isIgnored(checkout, `${RUN_DIR}/${dir}/${tree}`)) return false;
  const folder = recordFolder(checkout, dir, madeFolder);
  if (!folder) return false;
  try { replaceFile(join(folder, tree), JSON.stringify({ tree, ...fields })); } catch { return false; }
  dropOldestEntries(folder, isFile);
  return true;
}

// Writes the tree's record into the checkout's green stamp, dated now: whether it was written (writeRecord). `rerun`,
// when the tree went green on a rerun: { redDate, files }, the red run's date and the files rerun.
export const writeStamp = (checkout, tree, rerun) => writeRecord({ checkout, dir: STAMP_DIR }, tree, { date: now(), rerun });

// The tree's red run in the checkout: { date, files, next, step, rerun }, `files` the test files that failed, `next`
// the index of the first green step its rerun runs after them (null: none, the doc tests' run), `step` the line
// naming the step that went red when no test file did, else null, `rerun` { date, failed, step } once its rerun ran
// red, `failed` the test files it failed and `step` the step's line when it went red at one; null when there is none
// or it does not read so.
export function redRun(checkout, tree) {
  const fields = treeRecord(checkout, RED_DIR, tree);
  if (!fields) return null;
  const { date, files, next, step, rerun } = fields;
  const nextReads = next === null || (Number.isInteger(next) && next >= 0);
  const stepReads = step === null || typeof step === "string";
  const rerunStepReads = rerun?.step === undefined || rerun.step === null || typeof rerun.step === "string";
  const rerunReads = rerun === undefined || (isDate(rerun?.date) && isNames(rerun?.failed) && rerunStepReads);
  const reads = nextReads && stepReads && rerunReads && isNames(files);
  return reads ? { date, files, next, step, rerun } : null;
}

// A red run whose test files failed (redRun's fields): `next` the index of the first step after them, null when none
// runs after them, the doc tests' run.
export const redOnTests = (files, next) => ({ files, next, step: null });

// A red run that went red at a step and on no test file, the step's line naming it (redRun's fields).
export const redAtStep = (step) => ({ files: [], next: null, step });

// Writes the tree's red run into the checkout (redRun's fields; `date` now when not given): whether it was written.
export const writeRedRun = (checkout, tree, { date, files, next, step, rerun }) =>
  writeRecord({ checkout, dir: RED_DIR }, tree, { date: date ?? now(), files, next, step, rerun });

// The trees the checkout's green stamp holds, newest first, at most RECORDS_KEPT; each a record stampedRecord reads.
export function stampedTrees(checkout) {
  const folder = recordFolder(checkout, STAMP_DIR, ownFolder);
  const names = folder ? listNewestEntries(folder, isFile).slice(0, RECORDS_KEPT).map(([, name]) => name) : [];
  return names.filter((tree) => stampedRecord(checkout, tree));
}
