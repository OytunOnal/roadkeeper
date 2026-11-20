// @level infrastructure
// Roadkeeper — a record folder: a folder of .run/ in a clone's main checkout whose entries are named by a tree, each a
// record file (the green stamp's and the red runs', green-stamp.mjs) or a folder of records (suite records,
// suite-records.mjs). .run/ and each folder in it are read and written only when no link and the user's own, and only
// where git ignores them; the newest RECORDS_KEPT entries are kept, among the first ENTRIES_SCANNED read; a record's
// date is written and read as `now` says it.

import { lstatSync, mkdirSync, opendirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { OBJECT_HASH as TREE_HASH, git } from "../../_git.mjs";

export const RUN_DIR = ".run";       // the run output folder git ignores
export const RECORDS_KEPT = 50;      // the newest entries kept: a slice's parallel worktrees write a handful each
const ENTRIES_SCANNED = 1000;        // entries read from a folder: one holding more is read no further

// whether an entry's lstat is no link and the user's own; Windows keeps no owner id
export const isOwn = (st) => !st.isSymbolicLink() && (!process.getuid || st.uid === process.getuid());
export const ownFolder = (p) => { try { const st = lstatSync(p); return st.isDirectory() && isOwn(st); } catch { return false; } };
export const madeFolder = (p) => { try { mkdirSync(p); } catch { /* there already: ownFolder says what it is */ } return ownFolder(p); };

// The records' folder `dir` of RUN_DIR in the checkout, checked from its root down by `reach`; null when either folder
// is refused.
export function recordFolder(checkout, dir, reach) {
  const run = join(checkout, RUN_DIR);
  const folder = join(run, dir);
  return reach(run) && reach(folder) ? folder : null;
}

// Whether git ignores the path `path`, from the checkout's root, in the checkout.
export function isIgnored(checkout, path) {
  try { git(["check-ignore", "-q", path], checkout); return true; } catch { return false; }
}

export const isDate = (value) => typeof value === "string" && /^[\d: -]{1,32}$/.test(value);

// Whether JSON's `fields` are an object naming the tree `tree`: the first test of any record read.
export const isRecordOfTree = (fields, tree) => fields !== null && typeof fields === "object" && fields.tree === tree;

const two = (n) => String(n).padStart(2, "0");
export const now = () => { const d = new Date(); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; };

// An entry of the folder as [when written, name] when named by a tree, its lstat taken by `isEntry`, and the user's
// own; else null.
function writtenEntry(folder, name, isEntry) {
  if (!TREE_HASH.test(name)) return null;
  try { const st = lstatSync(join(folder, name)); return isEntry(st) && isOwn(st) ? [st.mtimeMs, name] : null; } catch { return null; }
}

// The folder's entries writtenEntry takes, [when written, name], newest first, among its first ENTRIES_SCANNED
// entries; none when the folder cannot be read.
export function listNewestEntries(folder, isEntry) {
  const entries = [];
  let dir = null;
  try {
    dir = opendirSync(folder);
    for (let entry, k = 0; k < ENTRIES_SCANNED && (entry = dir.readSync()); k++) entries.push(writtenEntry(folder, entry.name, isEntry));
  } catch { return []; } finally { dir?.closeSync(); }
  return entries.filter(Boolean).sort((a, b) => b[0] - a[0]);
}

// Removes every entry of the folder `isEntry` takes but the RECORDS_KEPT newest (listNewestEntries); one another run
// removed first is passed over.
export function dropOldestEntries(folder, isEntry) {
  for (const [, name] of listNewestEntries(folder, isEntry).slice(RECORDS_KEPT)) rmSync(join(folder, name), { recursive: true, force: true });
}
