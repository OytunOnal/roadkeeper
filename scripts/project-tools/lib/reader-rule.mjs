// @level domain
// Roadkeeper — the reader rule: what a test file's text naming a changed file is, by its path, its parts in order with
// separators, quotes or parentheses between (`join("docs", "site-map.md")` and `Path("docs") / "site-map.md"` name
// docs/site-map.md), or by one of its exported names as a whole word. A file's exported names are read from its own
// text by its kind: JS/TS names after `export function|const|let|class|async function` and inside `export { … }`,
// Python top-level `def` and `class`; any other file is named by its path alone.
// And, where a project records its edges (structure.json), what reaches a changed file: the files importing it, and
// their importers up to the top, and a test helper (a file only suites and other helpers import) naming a reached file
// by its path; a suite reads it when it is changed itself, imports a reached file, or names one
// by its path. Names do not count there. Pure: the texts and edges are the caller's.

import { escapeForPattern } from "../../_text.mjs";

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

// The names a JS/TS text exports: those declared exported, and each item of an `export { … }` list by its exported
// name, the word after `as` when it has one.
function jsNames(text) {
  const declared = [...text.matchAll(JS_DECLARED)].map((m) => m[1]);
  const listed = [...text.matchAll(JS_LISTED)].flatMap((m) => m[1].split(",").map((item) => item.trim().split(/\s+/).pop()));
  return [...declared, ...listed].filter((n) => NAME.test(n) && !NOT_A_NAME.has(n));
}

// The names the file at `path` exports, read from its text by its kind; none for another kind of file.
export function exportedNames(path, text) {
  if (JS_TS.test(path)) return jsNames(text);
  if (PYTHON.test(path)) return [...text.matchAll(PY_TOP)].map((m) => m[1]);
  return [];
}

// The pattern of a text naming the file at `path`: its parts in order with SEPARATORS between, no word
// running on at either end; or, given its exported `names`, one of them as a whole word.
export function namingPattern(path, names) {
  const byPath = `(?<![\\w.-])${path.split("/").map(escapeForPattern).join(SEPARATORS)}(?![\\w-]|\\.\\w)`;
  const byName = names.length ? `|(?<![\\w$])(?:${[...new Set(names)].map(escapeForPattern).join("|")})(?![\\w$])` : "";
  return new RegExp(byPath + byName);
}

// The files each file in `edges` ({ from, to }) leads to, one way: Map(file → its ends).
function adjacency(edges, [start, end]) {
  const next = new Map();
  for (const e of edges) {
    if (!next.has(e[start])) next.set(e[start], []);
    next.get(e[start]).push(e[end]);
  }
  return next;
}

// The test helpers of `suites` over `edges`: the files only suites and other helpers import, so the code under test,
// which other code imports too, is none.
export function testHelpers(suites, edges) {
  const importers = adjacency(edges, ["to", "from"]);
  const testSide = new Set(suites);
  const onlyTestSide = (f) => !testSide.has(f) && importers.get(f).every((i) => testSide.has(i));
  let found;
  do {
    found = [...importers.keys()].filter(onlyTestSide);
    for (const f of found) testSide.add(f);
  } while (found.length);
  const isSuite = new Set(suites);
  return [...testSide].filter((f) => !isSuite.has(f));
}

// The files reaching the `changed` ones, each with its steps from the nearest: Map(file → steps), a changed file 0.
// A step is an import (`edges`), or a helper of `helpers` whose text in `texts` names the file by its path.
function reachSteps({ changed, edges, helpers, texts }) {
  const importers = adjacency(edges, ["to", "from"]);
  const steps = new Map(changed.map((f) => [f, 0]));
  const todo = [...changed];
  for (let k = 0; k < todo.length; k += 1) {
    const file = todo[k];
    const pattern = namingPattern(file, []);
    const naming = helpers.filter((h) => !steps.has(h) && texts.has(h) && pattern.test(texts.get(h)));
    for (const f of [...(importers.get(file) ?? []), ...naming]) {
      if (!steps.has(f)) { steps.set(f, steps.get(file) + 1); todo.push(f); }
    }
  }
  return steps;
}

// Of `files`, the one fewest steps from a changed file, by path among equals; null for none.
function nearestOrNull(files, steps) {
  const order = (a, b) => steps.get(a) - steps.get(b) || (a < b ? -1 : 1);
  return [...files].sort(order)[0] ?? null;
}

// The reader tests of the `changed` files where a project records its `edges` ({ from, to }), among `suites`, with
// `texts` each suite's and helper's text by path, `helpers` testHelpers' list: each { file, through }, in the suites'
// order, `through` the reached file the suite imports or names that is nearest a changed file, null when that is a
// changed file, or the suite is one.
export function readersThroughEdges({ changed, suites, edges, helpers, texts }) {
  const steps = reachSteps({ changed, edges, helpers, texts });
  const imports = adjacency(edges, ["from", "to"]);
  const isSuite = new Set(suites);
  const named = [...steps.keys()].filter((f) => !isSuite.has(f));
  const anyNamed = named.length ? new RegExp(named.map((f) => namingPattern(f, []).source).join("|")) : null;
  const readers = [];
  for (const suite of suites) {
    const text = texts.get(suite);
    if (steps.get(suite) === 0) { readers.push({ file: suite, through: null }); continue; }
    const imported = (imports.get(suite) ?? []).filter((f) => steps.has(f) && !isSuite.has(f));
    const byPath = text !== undefined && anyNamed?.test(text) ? named.filter((f) => namingPattern(f, []).test(text)) : [];
    const via = nearestOrNull([...imported, ...byPath], steps);
    if (via !== null) readers.push({ file: suite, through: steps.get(via) === 0 ? null : via });
  }
  return readers;
}
