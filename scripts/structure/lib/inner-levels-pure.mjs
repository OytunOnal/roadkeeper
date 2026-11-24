// @level domain
// Roadkeeper — the inner levels held pure in Python: a kernel, domain or application Python file imports only the
// project's own modules and the standard modules that do no I/O, and never calls the clock or the built-in `open`. A
// module the project holds is its own, even when it shadows a standard one's name: a root `os.py` makes `import os` the
// project's. What breaks it, from the Python parser's outside uses (the Parsers port, dependency-graph.mjs); the
// baseline structure.json keeps of the files breaking it when the structure command first saw them, which only shrinks; and the two read back from structure.json.

import { parseJsonText } from "./parse-json-text.mjs";

// the rule's name, the lint's for JavaScript and TypeScript too
export const RULE = "inner-levels-pure";
// the levels purity bounds: no disk, clock, network or process; scripts/lint/rules/inner-levels-pure.mjs keeps the same
// list and the same every-level-inner test, since the lint copied into a project imports nothing outside its folder
const INNER_LEVELS = ["kernel", "domain", "application"];
// the standard modules an inner-level file may import: they compute, and open no file, socket, process or clock
const PURE_STANDARD_MODULES = new Set([
  "__future__", "abc", "ast", "bisect", "collections", "contextlib", "copy", "dataclasses", "datetime", "decimal", "difflib",
  "enum", "fractions", "functools", "hashlib", "heapq", "itertools", "json", "math", "numbers", "operator", "re",
  "statistics", "string", "textwrap", "types", "typing", "unicodedata",
]);
// a breach's name is quoted from the code: past this it does not read, and a module's dotted name fits
const NAME_MAX = 300;
// what a breach does with its name: an import's module, a clock call's or an `open` call's function
const USES = ["imports", "calls"];
// the outside uses that are calls: the clock's, and the built-in `open`'s
const CALL_KINDS = ["clock", "io"];

// whether a file's tag names inner levels alone: a file of mixed levels with an outer one is not held
const isInnerTag = (tag) => {
  const names = typeof tag === "string" ? tag.split(/\s+/).filter(Boolean) : [];
  return names.length > 0 && names.every((n) => INNER_LEVELS.includes(n));
};

// whether one outside use breaks the rule: a clock or `open` call, or a run-time import of a package or of a standard
// module outside PURE_STANDARD_MODULES; an import for types alone runs nothing
const breaksPurity = (use) => {
  if (CALL_KINDS.includes(use.kind)) return true;
  const pureStandard = use.stdlib && PURE_STANDARD_MODULES.has(use.name.split(".")[0]);
  return !use.typeOnly && !pureStandard;
};

const byFileThenLine = (a, b) => {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  return a.line - b.line;
};

// The breaches of the files `levels` tags at inner levels alone, a test's aside, from the parsers' `uses`: each
// { file, line, uses, name }, `uses` "imports" for an import, "calls" for a clock or `open` call, by file and line.
export function findBreaches(levels, uses, isTest) {
  const held = (u) => isInnerTag(levels[u.file]) && !isTest(u.file) && breaksPurity(u);
  return uses.filter(held).map((u) => ({ file: u.file, line: u.line, uses: CALL_KINDS.includes(u.kind) ? "calls" : "imports", name: u.name }))
    .sort(byFileThenLine);
}

// The baseline after a run: on first sight (`previous` null) every file the breaches name; after it, the files of
// `previous` still breaching, so the list never grows.
export function nextBaseline(previous, breaches) {
  const files = [...new Set(breaches.map((b) => b.file))].sort();
  return previous === null ? files : previous.filter((f) => files.includes(f));
}

// The check's rulings on purity over the structure model `sm` (structure-model.mjs): { refused, kept }, refused each
// breach of a file outside the baseline, kept each baselined file with its count of breaches, { file, count }.
export function purityRulings(sm) {
  const baseline = new Set(sm.impureBaseline), counts = new Map();
  for (const b of sm.impure) if (baseline.has(b.file)) counts.set(b.file, (counts.get(b.file) || 0) + 1);
  return { refused: sm.impure.filter((b) => !baseline.has(b.file)), kept: [...counts].map(([file, count]) => ({ file, count })) };
}

const isPathList = (v) => Array.isArray(v) && v.every((f) => typeof f === "string");

// The baseline structure.json's text holds, or null when it holds none: no text, not JSON, or no list of paths.
export function readBaseline(jsonText) {
  const data = parseJsonText(jsonText);
  const baseline = data && typeof data === "object" ? data.impureBaseline : undefined;
  return isPathList(baseline) ? baseline : null;
}

// structure.json's breaches and baseline, from its parsed `data`, each path read by `pathOf` (structure-path.mjs's):
// { impure, impureBaseline }, none for a field it lacks; what does not read is told to `bad(where, what)` and left out.
export function readPurity(data, bad, pathOf) {
  const impure = [], impureBaseline = [];
  for (const b of Array.isArray(data.impure) ? data.impure : []) {
    const f = pathOf(b && b.file), { line, uses, name } = b && typeof b === "object" ? b : {};
    const named = typeof name === "string" && name.length > 0 && name.length <= NAME_MAX;
    const reads = !f.why && Number.isInteger(line) && line >= 0 && USES.includes(uses) && named;
    if (reads) impure.push({ file: f.path, line, uses, name });
    else bad("structure.json impure", `a breach reads { file, line, uses: ${USES.join(" | ")}, name }, the name at most ${NAME_MAX} characters`);
  }
  if (data.impure !== undefined && !Array.isArray(data.impure)) bad("structure.json impure", "`impure` is not a list of breaches");
  for (const v of isPathList(data.impureBaseline) ? data.impureBaseline : []) {
    const f = pathOf(v);
    if (f.why) bad("structure.json impureBaseline", `a file ${f.why}`); else impureBaseline.push(f.path);
  }
  if (data.impureBaseline !== undefined && !isPathList(data.impureBaseline)) bad("structure.json impureBaseline", "`impureBaseline` is not a list of files");
  return { impure, impureBaseline };
}
