// @level infrastructure
// Roadkeeper — what the module's disk readers share: the bounded walk, and the one guarded read of the two structure files.
//
// The walk starts at the project root or a folder under it, each from its own path, never through a link — a link
// anywhere on the way, or under it, is never followed. It skips names starting with `.`, `node_modules` and
// structure.json itself, and walks each folder once, however many folders or spellings reach it. Bounded: MAX_FILES
// files met, MAX_DEPTH slashes and MAX_PATH characters a path — past a bound it stops and says so.
//
// The structure files, docs/roadkeeper/dependency-rules.md and structure.json, are read only from a plain docs/roadkeeper folder,
// with no link on the way from the root, each a plain file under STRUCTURE_CAP.

import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readPlainFile, recordsDir } from "../../_files.mjs";
import { MAX_DEPTH, MAX_PATH, STRUCTURE_CAP } from "./structure-model.mjs";

// a project's source: tens of thousands of files, read in a few seconds
const MAX_FILES = 50000;
// the structure files, from the project root
export const RULES = "docs/roadkeeper/dependency-rules.md", GRAPH = "docs/roadkeeper/structure.json";
// a folder's name the walk never enters: a tool's own state, and dependencies installed beside the code
export const SKIP = (name) => name.startsWith(".") || name === "node_modules";
const slashes = (p) => p.split("/").length - 1;

// Every plain file under the folders, "" the project root: { files: [{ rel, size }], over }. A link is never followed;
// `.`-names, node_modules and structure.json are left out. Each folder is walked from its own path — a nested one too,
// since an outer walk skips `.`-folders on the way — and read once however many folders or spellings reach it. Past a
// bound the walk stops and `over` names it.
export function walkFiles(root, folders) {
  const files = [], walked = new Set();
  let over = null;
  const walk = (rel) => {
    if (over) return;
    if (slashes(rel) > MAX_DEPTH || rel.length > MAX_PATH) { over = `a path deeper than ${MAX_DEPTH} folders or longer than ${MAX_PATH} characters`; return; }
    let st;
    try { st = lstatSync(join(root, rel)); } catch { return; }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      // known by the disk's own id, so a second spelling of it on a case-insensitive disk is the same folder; by its
      // path where the disk gives no id
      let id;
      try { const b = lstatSync(join(root, rel), { bigint: true }); id = b.ino ? `${b.dev}:${b.ino}` : rel; } catch { return; }
      if (walked.has(id)) return;
      walked.add(id);
      let names;
      try { names = readdirSync(join(root, rel)); } catch { return; }
      for (const n of names.sort()) if (!SKIP(n)) walk(rel ? `${rel}/${n}` : n);
      return;
    }
    // structure.json is written by the stamp after the digest: it is never part of its own digest
    if (!st.isFile() || rel === GRAPH) return;
    if (files.length >= MAX_FILES) { over = `more than ${MAX_FILES} files met`; return; }
    files.push({ rel, size: st.size });
  };
  for (const f of folders) walk(f);
  return { files, over };
}

// The structure files at `root`: { why, md, js, present } — `why` says docs/roadkeeper is no plain folder, and then nothing
// is read; else `md` and `js` are each file's text, or null when it is missing, a link, not a file or over the cap, and
// `present` whether either is there at all.
export function readStructureFiles(root) {
  if (!recordsDir(root)) return { why: "docs/roadkeeper is missing or a link", md: null, js: null, present: false };
  const [md, js] = [RULES, GRAPH].map((f) => readPlainFile(join(root, f), STRUCTURE_CAP));
  return { why: null, md, js, present: [RULES, GRAPH].some((f) => existsSync(join(root, f))) };
}
