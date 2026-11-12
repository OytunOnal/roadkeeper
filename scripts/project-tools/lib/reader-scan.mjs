// @level infrastructure
// Roadkeeper — the reader scan: the test files whose own text names a changed file, by its path, its parts in order
// with separators, quotes or parentheses between (`join("docs", "site-map.md")` and `Path("docs") / "site-map.md"`
// name docs/site-map.md), or, when names count, by one of its exported names as a whole word. A file's exported names
// are read from its own text by its kind: JS/TS names after `export function|const|let|class|async function` and
// inside `export { … }`, Python top-level `def` and `class`; any other file is named by its path alone. Only the test
// files' own text is read, never a helper they import. Every file is read only as a plain file inside the root with no
// link on the way, up to CAP; a file over it is said, its name shown safe, and skipped.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { readPlainFile } from "../../_files.mjs";
import { shownName, workingFile } from "./commit-tree.mjs";

const CAP = 512 * 1024; // bytes of one file read: many times the largest suite
const JS_TS = /\.(?:[cm]?[jt]s|[jt]sx)$/; // a JS/TS file, by its name
const PYTHON = /\.py$/;                   // a Python file, by its name
// a JS/TS name declared exported: after `export function`, `export async function`, `export const|let|class`
// (a generator's `*` and its spaces one optional group, so no run of spaces splits two ways: linear)
const JS_DECLARED = /\bexport\s+(?:(?:async\s+)?function\s*(?:\*\s*)?|(?:const|let|class)\s+)([A-Za-z_$][\w$]*)/g;
const JS_LISTED = /\bexport\s*\{([^}]{0,4096})\}/g; // a JS/TS `export { … }` list, its items
const PY_TOP = /^(?:(?:async\s+)?def|class)\s+([A-Za-z_]\w*)/gm; // a Python top-level def or class
const NAME = /^[A-Za-z_$][\w$]*$/; // a JS name, so a list item that is none names nothing
// what may stand between a path's parts: separators, quotes, a list's commas, and parentheses, as pathlib's
// `Path("docs") / "guide.md"` puts them
const SEPARATORS = "[\\s\"'`/\\\\,()]+";
const NOT_A_NAME = new Set(["default"]); // an `export { x as default }` names no word a test would say

const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The names a JS/TS text exports: those declared exported, and each item of an `export { … }` list by its exported
// name, the word after `as` when it has one.
function jsNames(text) {
  const declared = [...text.matchAll(JS_DECLARED)].map((m) => m[1]);
  const listed = [...text.matchAll(JS_LISTED)].flatMap((m) => m[1].split(",").map((item) => item.trim().split(/\s+/).pop()));
  return [...declared, ...listed].filter((n) => NAME.test(n) && !NOT_A_NAME.has(n));
}

// The names the file at `path` exports, read from its text by its kind; none for another kind of file.
function exportedNames(path, text) {
  if (JS_TS.test(path)) return jsNames(text);
  if (PYTHON.test(path)) return [...text.matchAll(PY_TOP)].map((m) => m[1]);
  return [];
}

// The pattern of a text naming the file at `path`: its parts in order with SEPARATORS between, no word
// running on at either end; or, given its exported `names`, one of them as a whole word.
function namingPattern(path, names) {
  const byPath = `(?<![\\w.-])${path.split("/").map(escaped).join(SEPARATORS)}(?![\\w-]|\\.\\w)`;
  const byName = names.length ? `|(?<![\\w$])(?:${[...new Set(names)].map(escaped).join("|")})(?![\\w$])` : "";
  return new RegExp(byPath + byName);
}

// The file at `path` from the root `root`: { text } when a plain file inside it with no link on the way, under CAP;
// { over } when over it, `over` the line saying so; {} when it is none.
function cappedText(root, path) {
  const file = workingFile(root, path);
  if (!file) return {};
  const full = join(root, ...file.split("/"));
  const over = `${shownName(file)} not read: over the ${CAP / 1024} KB cap`;
  try { if (lstatSync(full).size > CAP) return { over }; } catch { return {}; }
  const text = readPlainFile(full, CAP);
  return text === null ? {} : { text };
}

// The reader tests of the `changed` files among the `tests`, both by their paths from the root `root`: { read,
// readers, said }, `read` the count of test files read, `readers` each test file naming a changed file as { file,
// reads }, `reads` the changed paths it names, in the tests' order, `said` a line for each file over CAP. `byNames`:
// whether a changed file's exported names count, else its path alone.
export function readerScan({ root, tests, changed, byNames }) {
  const said = [];
  const textOf = (path) => { const got = cappedText(root, path); if (got.over) said.push(got.over); return got.text; };
  const patterns = changed.map((path) => {
    const text = byNames ? textOf(path) : undefined;
    return { path, pattern: namingPattern(path, text === undefined ? [] : exportedNames(path, text)) };
  });
  let read = 0;
  const readers = [];
  for (const file of tests) {
    const text = textOf(file);
    if (text === undefined) continue;
    read += 1;
    const reads = patterns.filter((p) => p.pattern.test(text)).map((p) => p.path);
    if (reads.length) readers.push({ file, reads });
  }
  return { read, readers, said };
}
