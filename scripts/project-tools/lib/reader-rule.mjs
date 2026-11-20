// @level domain
// Roadkeeper — the reader rule: what a test file's text naming a changed file is, by its path, its parts in order with
// separators, quotes or parentheses between (`join("docs", "site-map.md")` and `Path("docs") / "site-map.md"` name
// docs/site-map.md), or by one of its exported names as a whole word. A file's exported names are read from its own
// text by its kind: JS/TS names after `export function|const|let|class|async function` and inside `export { … }`,
// Python top-level `def` and `class`; any other file is named by its path alone.
// And, where a project records its edges (structure.json), what reaches a changed file: the files importing it, and
// their importers up to the top, and a test helper (a file only suites and other helpers import) naming a reached file
// by its path, outside an import statement. A helper's naming is tied to its top-level definitions
// (top-level-definitions.mjs): it reaches through the functions, classes and constants whose definitions name the file,
// and those using them, followed within the helper; a suite or helper importing it reaches through it only when it uses
// one of those names. A top-level statement outside any definition naming the file reaches it for every importer,
// since importing runs it. A run list the project declares (a file listing commands a test runs) is a step too: it
// reaches each file its text names by its path, whole, and a suite or helper naming it reaches through it. A suite
// reads it when it is changed itself, imports a reached file (using its reaching names where it has them), or names one
// by its path. Names do not count there. Pure: the texts, edges and run lists are the caller's.
// The boundary, on both: a path in a plain string counts; a bare file name counts only for a file of that name in the
// naming file's own folder, any other bare name not; nor does a comment or docstring, dropped before any matching: a
// Python or JS/TS file's comments, and a Python string statement that is a module's, a function's or a class's first
// statement. A script another script starts, by its path or a sibling name rather than an import, is not seen. Each
// text is read once, linearly.

import { escapeForPattern } from "../../_text.mjs";
import { JS_TS, PYTHON, namingText } from "./naming-text.mjs";
import { WHOLE, codeReferences, helperBindings, namesReached, textOutsideImports, topLevelDefinitions, usesHelper }
  from "./top-level-definitions.mjs";

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
  const pathSource = `(?<![\\w.-])${path.split("/").map(escapeForPattern).join(SEPARATORS)}(?![\\w-]|\\.\\w)`;
  const nameSource = names.length ? `|(?<![\\w$])(?:${[...new Set(names)].map(escapeForPattern).join("|")})(?![\\w$])` : "";
  return new RegExp(pathSource + nameSource);
}

// The folder of the file at `path`, its closing slash kept; "" at the root.
function folderOf(path) {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

// Whether the text of the file at `namer` names the file at `path` by its bare name: both sit in one folder, and the
// name stands as a whole word, as namingPattern reads a path.
export function namesSibling(namer, path, text) {
  const folder = folderOf(path);
  return folderOf(namer) === folder && namingPattern(path.slice(folder.length), []).test(text);
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

// The top-level definitions of the files whose texts `texts` holds, each read once (topLevelDefinitions): a reader of
// them by path, null for a file it holds no text of or one of another kind.
function definitionsReader(texts) {
  const read = new Map();
  return (file) => {
    if (!read.has(file)) read.set(file, texts.has(file) ? topLevelDefinitions(file, texts.get(file)) : null);
    return read.get(file);
  };
}

// What of the file `importer` reaches through the file `file` it imports, `file` reached through its top-level names
// `tied.get(file)`, or whole when it has none there: WHOLE, the importer's own names using them, or null for none.
/** @returns {import("./top-level-definitions.mjs").Reach} */
function throughImport(importer, file, { tied, texts, definitionsOf }) {
  const names = tied.get(file);
  if (names === undefined) return WHOLE;
  const definitions = definitionsOf(importer);
  const bindings = definitions && helperBindings(importer, texts.get(importer), file);
  if (!definitions || bindings === WHOLE) return WHOLE;
  return namesReached(definitions, (d) => !d.isImport && usesHelper(bindings, d.references, names));
}

// What of the helper `helper` reaches the file `file` by naming it, by its path or its bare name from its own folder,
// outside an import statement (an import is an edge): WHOLE, the names whose definitions name it, or null when its
// text names it nowhere.
/** @returns {import("./top-level-definitions.mjs").Reach} */
function throughNaming(helper, file, { texts, definitionsOf }) {
  const pattern = namingPattern(file, []);
  const names = (text) => pattern.test(text) || namesSibling(helper, file, text);
  if (!names(texts.get(helper))) return null;
  const definitions = definitionsOf(helper);
  return definitions ? namesReached(definitions, (d) => !d.isImport && names(d.text)) : WHOLE;
}

// A reach of a file at a step, kept in `steps` (file → steps) and `tied` (file → the names it is reached through),
// the file queued on `todo` again whenever what reaches it grows: `got` its Reach (top-level-definitions.mjs).
const reacher = ({ steps, tied, todo }) => (file, got, step) => {
  if (got === null) return;
  const had = tied.get(file);
  if (!steps.has(file)) {
    steps.set(file, step);
    if (got !== WHOLE) tied.set(file, got);
  } else if (had === undefined) return;
  else if (got === WHOLE) tied.delete(file);
  else if ([...got].every((n) => had.has(n))) return;
  else for (const n of got) had.add(n);
  todo.push(file);
};

// The files reaching the `changed` ones: { steps, tied }, `steps` each file's steps from the nearest (a changed file
// 0), `tied` the files reached only through some of their top-level names, by those names. A step is an import
// (`edges`), or a helper of `helpers` whose text in `texts` names the file by its path, or by its bare name from its
// own folder, or a run list of `runLists` whose text names the file by its path, reached whole. A helper naming a file
// reaches it through the definitions naming it (throughNaming); its importer, a suite aside, through the definitions
// using those (throughImport); a suite's own use is the caller's to read.
function reachSteps({ changed, edges, helpers, runLists, texts, suites }) {
  const importers = adjacency(edges, ["to", "from"]);
  const isSuite = new Set(suites);
  const reached = { steps: new Map(changed.map((f) => [f, 0])), tied: new Map(), todo: [...changed] };
  const reach = reacher(reached);
  const reading = { tied: reached.tied, texts, definitionsOf: definitionsReader(texts) };
  const lists = runLists.filter((x) => texts.has(x));
  for (let k = 0; k < reached.todo.length; k += 1) {
    const file = reached.todo[k];
    const step = reached.steps.get(file) + 1;
    for (const f of importers.get(file) ?? []) if (!isSuite.has(f) || !reached.tied.has(file)) reach(f, throughImport(f, file, reading), step);
    for (const h of helpers.filter((x) => texts.has(x))) reach(h, throughNaming(h, file, reading), step);
    const pathPattern = lists.length ? namingPattern(file, []) : null;
    for (const r of lists) reach(r, pathPattern.test(texts.get(r)) ? WHOLE : null, step);
  }
  return { steps: reached.steps, tied: reached.tied };
}

// Whether the suite `suite`, its text `text`, uses what reaches through the file `file` it imports: always when `file`
// is reached whole, else when it uses one of the names `tied` holds for it.
function suiteUses([suite, text], file, tied) {
  const names = tied.get(file);
  if (names === undefined || text === undefined) return true;
  return usesHelper(helperBindings(suite, text, file), codeReferences(suite, text), names);
}

// Of `files`, the one fewest steps from a changed file, by path among equals; null for none.
function nearestOrNull(files, steps) {
  const order = (a, b) => steps.get(a) - steps.get(b) || (a < b ? -1 : 1);
  return [...files].sort(order)[0] ?? null;
}

// The reached files of `named` the suite `suite`, its text `text`, names by path or by its bare name from its own
// folder; a file `tied` holds, reached through some of its names, only outside the suite's import statements, which
// import it whole as the edges say. `anyNamed`: a pattern any of `named`'s paths matches, or null for none.
function namedBySuite([suite, text], { named, anyNamed, tied }) {
  if (text === undefined) return [];
  const outside = tied.size ? textOutsideImports(suite, text) : text;
  const own = (f) => (tied.has(f) ? outside : text);
  const namedByPath = anyNamed?.test(text) ? named.filter((f) => namingPattern(f, []).test(own(f))) : [];
  return [...namedByPath, ...named.filter((f) => namesSibling(suite, f, own(f)))];
}

// The reader tests of the `changed` files where a project records its `edges` ({ from, to }), among `suites`, with
// `texts` each suite's, helper's and run list's text by path, `helpers` testHelpers' list, `runLists` the project's run
// lists: each { file, through }, in the suites' order, `through` the reached file the suite imports or names that is
// nearest a changed file, null when that is a changed file, or the suite is one.
export function readersThroughEdges({ changed, suites, edges, helpers, runLists = [], texts: written }) {
  const texts = new Map([...written].map(([file, text]) => [file, namingText(file, text)]));
  const { steps, tied } = reachSteps({ changed, edges, helpers, runLists, texts, suites });
  const imports = adjacency(edges, ["from", "to"]);
  const isSuite = new Set(suites);
  const named = [...steps.keys()].filter((f) => !isSuite.has(f));
  const anyNamed = named.length ? new RegExp(named.map((f) => namingPattern(f, []).source).join("|")) : null;
  const readers = [];
  for (const suite of suites) {
    const text = texts.get(suite);
    if (steps.get(suite) === 0) { readers.push({ file: suite, through: null }); continue; }
    const reaching = (f) => steps.has(f) && !isSuite.has(f) && suiteUses([suite, text], f, tied);
    const imported = (imports.get(suite) ?? []).filter(reaching);
    const via = nearestOrNull([...imported, ...namedBySuite([suite, text], { named, anyNamed, tied })], steps);
    if (via !== null) readers.push({ file: suite, through: steps.get(via) === 0 ? null : via });
  }
  return readers;
}
