// @level infrastructure
// Roadkeeper — suite records: for one tree, one record per suite whose run there read a case and every case passed or
// skipped, in .run/suite-records/<tree>/ of the clone's main checkout, shared by every worktree of the clone: each
// case's id, name, outcome and skip reason, and the date written. Read and written as the green stamp's records are
// (record-folder.mjs): .run/, its folders and each record only when no link and the user's own, a record written
// beside itself and renamed into place, only where git ignores it, read under RECORD_MAX. A record found that does not
// read says why. The newest trees' folders are kept (record-folder.mjs, RECORDS_KEPT).

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { OBJECT_HASH as TREE_HASH } from "../../_git.mjs";
import { readPlainFile, replaceFile } from "../../_files.mjs";
import { plural } from "../../_text.mjs";
import { RECORDS_KEPT, RUN_DIR, dropOldestEntries, isDate, isIgnored, isOwn, isRecordOfTree, listNewestEntries, madeFolder,
  now, ownFolder, recordFolder } from "./record-folder.mjs";

const RECORDS_DIR = "suite-records"; // the suite records' folder in RUN_DIR
const RECORD_MAX = 512 * 1024;       // bytes read from a record: a suite's case names and skip reasons
const RECORDED = new Set(["PASS", "SKIP"]); // the outcomes a suite record holds: any other leaves the suite unrecorded

const isFolder = (st) => st.isDirectory(); // a tree's entry in the records' folder is a folder of suite records

// The one file name a suite's record takes: its path, encoded.
const nameRecordFile = (suite) => encodeURIComponent(suite);

// The suite's cases among `cases` when they may stand as its record: at least one, each passed or skipped; else null.
function findRecordableCases(cases, suite) {
  const own = cases.filter((c) => c.file === suite);
  return own.length && own.every((c) => RECORDED.has(c.outcome)) ? own : null;
}

// The records' folder in the checkout `main`, with the tree's folder in it made where missing; null when a folder on the
// way is refused.
function makeRecordsFolder(main, tree) {
  const folder = recordFolder(main, RECORDS_DIR, madeFolder);
  return folder && madeFolder(join(folder, tree)) ? folder : null;
}

// Writes a suite record for the tree of each of `suites` whose `cases` may stand as one (findRecordableCases), into the
// checkout `main`, then drops the oldest trees' folders: the count of records that could not be written, none where
// git does not ignore the records' folder (nothing is written there by design).
export function writeSuiteRecords(main, tree, { cases, suites }) {
  const recordables = suites.map((suite) => [suite, findRecordableCases(cases, suite)]).filter(([, own]) => own);
  const nothingToWrite = !recordables.length || !TREE_HASH.test(tree) || !isIgnored(main, `${RUN_DIR}/${RECORDS_DIR}/${tree}/`);
  if (nothingToWrite) return 0;
  const folder = makeRecordsFolder(main, tree);
  if (!folder) return recordables.length;
  let unwritten = 0;
  for (const [suite, own] of recordables) {
    const kept = own.map(({ id, name, outcome, skipReason }) => ({ id, name, outcome, skipReason }));
    try { replaceFile(join(folder, tree, nameRecordFile(suite)), JSON.stringify({ tree, suite, date: now(), cases: kept })); } catch { unwritten += 1; }
  }
  dropOldestEntries(folder, isFolder);
  return unwritten;
}

// The line saying how many suite records could not be written, led by `label`.
export const formatUnwrittenLine = (unwritten, label) => `${label}: ${plural(unwritten, "suite record")} could not be written`;

// Whether something is at `path` that is not a plain folder of the user's own.
const isRefusedFolder = (path) => { try { lstatSync(path); } catch { return false; } return !ownFolder(path); };

// Why the suite records of the checkout `main` cannot be read at all: .run/ or its records' folder there but a link,
// not a folder or not the user's own; null when they can, or are not there.
export function findRecordsRefusal(main) {
  const run = join(main, RUN_DIR);
  if (isRefusedFolder(run)) return `${RUN_DIR}/ is a link, not a folder or not your own`;
  if (isRefusedFolder(join(run, RECORDS_DIR))) return `${RUN_DIR}/${RECORDS_DIR}/ is a link, not a folder or not your own`;
  return null;
}

// The trees holding suite records in the checkout `main`, newest first, at most RECORDS_KEPT.
export function listRecordedTrees(main) {
  const folder = recordFolder(main, RECORDS_DIR, ownFolder);
  return folder ? listNewestEntries(folder, isFolder).slice(0, RECORDS_KEPT).map(([, name]) => name) : [];
}

const isText = (value) => typeof value === "string";
const isRecordedCase = (c) => c !== null && typeof c === "object" && isText(c.id) && isText(c.name) && RECORDED.has(c.outcome) && isText(c.skipReason);

// Whether the fields read are the suite record of `suite` on `tree`.
const isRecordOf = (fields, { tree, suite }) => isRecordOfTree(fields, tree) && fields.suite === suite
  && isDate(fields.date) && Array.isArray(fields.cases) && fields.cases.length > 0 && fields.cases.every(isRecordedCase);

// Why an entry cannot be read as a record, by its lstat `st`: a link, not the user's own, not a file, over RECORD_MAX;
// null when it may be read.
function findEntryRefusal(st) {
  if (st.isSymbolicLink()) return "it is a link";
  if (!isOwn(st)) return "it is not your own";
  if (!st.isFile()) return "it is not a file";
  return st.size > RECORD_MAX ? `it is over its ${RECORD_MAX / 1024} KB cap` : null;
}

// The suite record of `suite` on `tree` in the checkout `main`: { cases, date }, each case as an adapter gives it; or
// { unread }, the words saying why the record found there does not read; null when there is none.
export function readSuiteRecord(main, tree, suite) {
  const folder = TREE_HASH.test(tree) ? recordFolder(main, RECORDS_DIR, ownFolder) : null;
  if (!folder) return null;
  let treeFolder;
  try { treeFolder = lstatSync(join(folder, tree)); } catch { return null; }
  if (!treeFolder.isDirectory() || !isOwn(treeFolder)) return { unread: "its tree's folder is a link, not a folder or not your own" };
  const path = join(folder, tree, nameRecordFile(suite));
  let st;
  try { st = lstatSync(path); } catch { return null; }
  const refused = findEntryRefusal(st);
  if (refused) return { unread: refused };
  let fields;
  try { fields = JSON.parse(readPlainFile(path, RECORD_MAX)); } catch { fields = null; }
  if (!isRecordOf(fields, { tree, suite })) return { unread: "it is not a suite record of this suite and tree" };
  const cases = fields.cases.map((c) => ({ file: suite, id: c.id, name: c.name, outcome: c.outcome, detail: "", text: "", skipReason: c.skipReason }));
  return { cases, date: fields.date };
}
