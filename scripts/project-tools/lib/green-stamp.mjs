// @level infrastructure
// Roadkeeper — the green stamp: a record per tree that ran green, in .run/green-stamp/ of the clone's main checkout, shared
// by every worktree of the clone. A record is the tree's hash as its name, holding the tree and the date. .run/, its
// green-stamp/ and each record are read and written only when no link and the user's own; a record is written beside
// itself and renamed into place, and only where git ignores it, so a stamp never dirties the tree it stamps. The newest
// RECORDS_KEPT are kept.

import { lstatSync, mkdirSync, opendirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { OBJECT_HASH as TREE_HASH, git } from "../../_git.mjs";
import { readPlainFile, replaceFile } from "../../_files.mjs";

const RUN_DIR = ".run";            // the run output folder git ignores
const STAMP_DIR = "green-stamp";   // the green stamp's folder in RUN_DIR
const RECORDS_KEPT = 50;           // the newest records kept: a slice's parallel worktrees write a handful each
const RECORDS_SCANNED = 1000;      // entries read from the folder when the oldest go: one holding more is left as it is
const RECORD_MAX = 64 * 1024;      // bytes read from a record: a tree's hash and a date

// whether an entry's lstat is no link and the user's own; Windows keeps no owner id
const isOwn = (st) => !st.isSymbolicLink() && (!process.getuid || st.uid === process.getuid());
const ownFolder = (p) => { try { const st = lstatSync(p); return st.isDirectory() && isOwn(st); } catch { return false; } };
const madeFolder = (p) => { try { mkdirSync(p); } catch { /* there already: ownFolder says what it is */ } return ownFolder(p); };

// The green stamp's folder in the checkout, checked from its root down by `reach`; null when either folder is refused.
function stampFolder(checkout, reach) {
  const run = join(checkout, RUN_DIR);
  const folder = join(run, STAMP_DIR);
  return reach(run) && reach(folder) ? folder : null;
}

// The tree's record in the checkout's green stamp, { date }; null when there is none, or it is a link, not the user's,
// over its cap or not a record of that tree.
export function stampedRecord(checkout, tree) {
  const folder = TREE_HASH.test(tree) ? stampFolder(checkout, ownFolder) : null;
  if (!folder) return null;
  const path = join(folder, tree);
  try { if (!isOwn(lstatSync(path))) return null; } catch { return null; }
  let fields;
  try { fields = JSON.parse(readPlainFile(path, RECORD_MAX)); } catch { return null; }
  const isRecord = fields !== null && typeof fields === "object" && fields.tree === tree;
  const printable = isRecord && typeof fields.date === "string" && /^[\d: -]{1,32}$/.test(fields.date);
  return printable ? { date: fields.date } : null;
}

const two = (n) => String(n).padStart(2, "0");
const now = () => { const d = new Date(); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; };

// Writes the tree's record into the checkout's green stamp, then drops the oldest: whether it was written. Nothing is
// written where git does not ignore the record's path, nor through a link.
export function writeStamp(checkout, tree) {
  if (!TREE_HASH.test(tree)) return false;
  try { git(["check-ignore", "-q", `${RUN_DIR}/${STAMP_DIR}/${tree}`], checkout); } catch { return false; }
  const folder = stampFolder(checkout, madeFolder);
  if (!folder) return false;
  try { replaceFile(join(folder, tree), JSON.stringify({ tree, date: now() })); } catch { return false; }
  dropOldest(folder);
  return true;
}

// An entry of the green stamp's folder as [when written, name] when it is a record, a file and the user's own; else null.
function writtenRecord(folder, name) {
  if (!TREE_HASH.test(name)) return null;
  try { const st = lstatSync(join(folder, name)); return st.isFile() && isOwn(st) ? [st.mtimeMs, name] : null; } catch { return null; }
}

// The folder's records, [when written, name], newest first, among its first RECORDS_SCANNED entries; null when the
// folder cannot be read.
function newestRecords(folder) {
  const records = [];
  let dir = null;
  try {
    dir = opendirSync(folder);
    for (let entry, k = 0; k < RECORDS_SCANNED && (entry = dir.readSync()); k++) records.push(writtenRecord(folder, entry.name));
  } catch { return null; } finally { dir?.closeSync(); }
  return records.filter(Boolean).sort((a, b) => b[0] - a[0]);
}

// Every record but the RECORDS_KEPT newest removed, by when each was written; one another run removed first is passed
// over.
function dropOldest(folder) {
  for (const [, name] of (newestRecords(folder) ?? []).slice(RECORDS_KEPT)) rmSync(join(folder, name), { force: true });
}

// The trees the checkout's green stamp holds, newest first, at most RECORDS_KEPT; each a record stampedRecord reads.
export function stampedTrees(checkout) {
  const folder = stampFolder(checkout, ownFolder);
  const names = folder ? (newestRecords(folder) ?? []).slice(0, RECORDS_KEPT).map(([, name]) => name) : [];
  return names.filter((tree) => stampedRecord(checkout, tree));
}
