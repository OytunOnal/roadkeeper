// @level domain
// Roadkeeper — a test file's top-level definitions, for the reader rule (reader-rule.mjs): a Python or JS/TS text, its
// comments and docstrings already dropped (naming-text.mjs), read as its top-level statements, each one starting a line
// at its first column outside a string (in Python also outside brackets, and not after a line ending in `\`; a
// decorator goes with what it decorates). A statement is a definition naming what it defines: in Python a `def`, a
// `class`, an assignment to one name or a comma list of names; in JS/TS a function, a class, a `const|let|var` of one
// name. Any other, an import, an `if` or a JS declaration of several names, defines nothing, and so does a value's
// definition calling a function or class the file defines, which importing runs. And the names a file
// importing a helper takes from it: Python `from <helper> import …` and `import <helper> [as …]`; JS/TS
// `import { … } | * as … from` the helper's file, a default import taking all of it. A name is used where it stands in
// code, not a string, as a word or a word's first part before a dot. Pure, and each text is read linearly; the regexes
// are bounded.

import { JS_TS, PYTHON, SPACE, bracketDepth, codeMask } from "./source-lexing.mjs";

export const WHOLE = "whole"; // a file reached whole: every importer reaches through it, whatever names it uses
/** What of a file reaches a changed file: WHOLE, the Set of its top-level names it reaches through, or null for none.
 * @typedef {typeof WHOLE | Set<string> | null} Reach */
const PY_DEFINED = /^(?:async[ \t]+)?(?:def|class)[ \t]+([A-Za-z_]\w*)/m; // at a line's first column: a decorator before
// an assignment to names, its first word no keyword opening a block (`else: x = 1` assigns in a block)
const PY_ASSIGNED = /^(?!(?:if|elif|else|try|except|finally|for|while|with|async|return|lambda)\b)([A-Za-z_]\w*(?:[ \t]*,[ \t]*[A-Za-z_]\w*){0,16})[ \t]*(?::[^=\n]{0,256})?=(?!=)/;
const PY_IMPORT = /^(?:from|import)\b/; // a statement importing, which defines no name of its file's own
const REFERENCE = /(?<![\w$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){0,16}/g; // a word, and the words dotted after it
// a `from <module> import <names>` line, its names in brackets over lines or to the line's end (the module never
// empty, so no run of spaces splits two ways: linear)
const PY_FROM = /^[ \t]*from[ \t]+(\.{1,8}[\w.]{0,256}|[\w.]{1,256})[ \t]+import[ \t]+(\([^)]{0,4096}\)|[^\n]{0,4096})/gm;
const PY_IMPORTS = /^[ \t]*import[ \t]+([^\n]{0,4096})/gm; // an `import <modules>` line
const PY_ITEM = /^([\w.]{1,256})(?:[ \t]+as[ \t]+(\w{1,256}))?$/; // `name` or `name as alias`
// a JS/TS function, class or `const|let|var` declared, exported or not: its declaring word and its name (a generator's
// `*` and its spaces one optional group, so no run of spaces splits two ways: linear)
const JS_DEFINED = /^(?:export[ \t]+)?(?:default[ \t]+)?(?:async[ \t]+)?(?:function[ \t]*(?:\*[ \t]*)?|class[ \t]+|(const|let|var)[ \t]+)([A-Za-z_$][\w$]*)/;
// a JS/TS function or class declared, or a `const|let|var` holding a function or an arrow function
const JS_CALLABLE = /^(?:export[ \t]+)?(?:default[ \t]+)?(?:async[ \t]+)?(?:function\b|class\b|(?:const|let|var)[ \t]+[A-Za-z_$][\w$]*[ \t]*=[ \t]*(?:async[ \t]*)?(?:function\b|\([^)]{0,512}\)[ \t]*=>|[A-Za-z_$][\w$]*[ \t]*=>))/;
const CALL = /(?<![\w$.])([A-Za-z_$][\w$]*)[ \t]*\(/g; // a word called
const JS_IMPORT = /^import\b(?![ \t]*\()/; // an import declaration, not an `import(…)` call
// a JS/TS `import <clause> from "<specifier>"` (the clause opening on no space and holding the spaces before `from`, so
// no run of spaces splits two ways: linear)
const JS_FROM = /\bimport[ \t\r\n]+([^;'"` \t\r\n][^;'"`]{0,4096}?)\bfrom[ \t\r\n]*["']([^"'\n]{1,512})["']/g;
const JS_BARE = /\bimport[ \t]*["']([^"'\n]{1,512})["']/g; // a JS/TS import for its run alone

// The indices where the top-level statements of a code mask start: a line's first column holding no space and no
// closing bracket; in `python`, outside brackets and not after a line ending in `\` (JS's regex literals leave its
// brackets uncounted).
function statementStarts(mask, python) {
  const starts = [];
  let depth = 0;
  let last = "\n"; // the last character that is not a space
  for (let i = 0; i < mask.length; i += 1) {
    const c = mask[i];
    const atFirstColumn = i === 0 || mask[i - 1] === "\n";
    const opensCode = !SPACE.has(c) && c !== "\n" && !")]}".includes(c);
    const continues = python && (depth > 0 || last === "\\");
    const opensStatement = atFirstColumn && opensCode && !continues;
    if (opensStatement) starts.push(i);
    depth = bracketDepth(depth, c);
    if (!SPACE.has(c) && c !== "\n") last = c;
  }
  return starts;
}

// Whether a JS declaration's code `mask` holds a comma outside brackets: it declares several names.
function declaresSeveral(mask) {
  let depth = 0;
  for (const c of mask) {
    if (c === "," && depth === 0) return true;
    depth = bracketDepth(depth, c);
  }
  return false;
}

// The names a top-level statement's code `mask` defines, read as `python` or JS/TS; none for a statement defining
// nothing.
function definedNames(mask, python) {
  if (python) {
    const defined = mask.match(PY_DEFINED) ?? mask.match(PY_ASSIGNED);
    return defined ? defined[1].split(",").map((n) => n.trim()) : [];
  }
  const defined = mask.match(JS_DEFINED);
  const definesOne = defined !== null && !(defined[1] && declaresSeveral(mask));
  return definesOne ? [defined[2]] : [];
}

// The references in a code mask: each word, with the words dotted after it, as its parts.
function referencesIn(mask) {
  return [...mask.matchAll(REFERENCE)].map((m) => m[0].split("."));
}

// The references in the code of the file at `path`, its text `text`: each a word with the words dotted after it.
export function codeReferences(path, text) {
  return referencesIn(codeMask(path, text));
}

// Whether a top-level statement's code `mask` defines a function or a class, read as `python` or JS/TS.
function definesCallable(mask, python) {
  return (python ? PY_DEFINED : JS_CALLABLE).test(mask);
}

// Whether a top-level statement's code `mask` calls one of the `callables` its file defines: importing runs it.
function callsOneOf(mask, callables) {
  return [...mask.matchAll(CALL)].some((m) => callables.has(m[1]));
}

// The top-level statements of the Python or JS/TS file at `path`, from its `text`: each { names, isImport, text,
// references }, `names` what it defines, `text` its own; null for another kind of file. A definition of a value that
// calls a function or class the file defines runs it on import, so defines nothing.
export function topLevelDefinitions(path, text) {
  const python = PYTHON.test(path);
  if (!python && !JS_TS.test(path)) return null;
  const mask = codeMask(path, text);
  const starts = statementStarts(mask, python).filter((s, k, all) => k === 0 || mask[all[k - 1]] !== "@");
  const statements = starts.map((start, k) => {
    const part = mask.slice(start, starts[k + 1] ?? mask.length);
    return { part, callable: definesCallable(part, python), names: definedNames(part, python),
             isImport: (python ? PY_IMPORT : JS_IMPORT).test(part), text: text.slice(start, starts[k + 1] ?? text.length),
             references: referencesIn(part) };
  });
  const callables = new Set(statements.filter((s) => s.callable).flatMap((s) => s.names));
  return statements.map(({ part, callable, ...s }) => (!callable && callsOneOf(part, callables) ? { ...s, names: [] } : s));
}

// The text of the file at `path` but its top-level import statements, which name a file to import it, not to run it;
// a file of another kind whole.
export function textOutsideImports(path, text) {
  const definitions = topLevelDefinitions(path, text);
  return definitions ? definitions.filter((d) => !d.isImport).map((d) => d.text).join("\n") : text;
}

// The definitions using each name, by the words their references start with, imports left out: Map(name → them).
function usersByName(definitions) {
  const users = new Map();
  for (const d of definitions.filter((x) => !x.isImport)) {
    for (const [word] of d.references) {
      if (!users.has(word)) users.set(word, []);
      users.get(word).push(d);
    }
  }
  return users;
}

// The names reached among `definitions` (topLevelDefinitions'): those of each definition `seeded` marks, and of each
// definition using a reached name, followed; WHOLE when a statement defining nothing is among them, null for none.
/** @returns {Reach} */
export function namesReached(definitions, seeded) {
  const users = usersByName(definitions);
  const todo = definitions.filter(seeded);
  const seen = new Set(todo);
  const reached = new Set();
  for (let k = 0; k < todo.length; k += 1) {
    if (!todo[k].names.length) return WHOLE;
    for (const name of todo[k].names.filter((n) => !reached.has(n))) {
      reached.add(name);
      for (const user of (users.get(name) ?? []).filter((u) => !seen.has(u))) { seen.add(user); todo.push(user); }
    }
  }
  return reached.size ? reached : null;
}

// What a Python code mask `text` (its strings put out) takes from the helper module named `stem`: its `from … import`
// names (local → the helper's), whether one imports `*`, and the module's bindings, each as its dotted parts.
function pythonBindings(text, stem) {
  const taken = { names: new Map(), star: false, modules: [], found: false };
  const items = (list) => list.replace(/[()\\]/g, " ").split(",").map((i) => i.trim().match(PY_ITEM)).filter(Boolean);
  for (const [, from, list] of text.matchAll(PY_FROM)) {
    const ofHelper = from === stem || from.endsWith("." + stem);
    if (ofHelper && /^\s*\*\s*$/.test(list)) { taken.star = taken.found = true; continue; }
    for (const [, name, alias] of items(list)) {
      if (ofHelper) { taken.names.set(alias ?? name, name); taken.found = true; }
      else if (name === stem) { taken.modules.push([alias ?? name]); taken.found = true; }
    }
  }
  for (const [, list] of text.matchAll(PY_IMPORTS)) {
    for (const [, name, alias] of items(list).filter(([, n]) => n.split(".").at(-1) === stem)) {
      taken.modules.push(alias ? [alias] : name.split("."));
      taken.found = true;
    }
  }
  return taken;
}

// What a JS/TS `text` takes from the helper file named `name`, `stem` without its ending: its `import { … }` names
// (local → the helper's), its `* as` bindings; WHOLE for a default import.
function jsBindings(text, { name, stem }) {
  const taken = { names: new Map(), star: false, modules: [], found: false };
  const isHelper = (spec) => [name, stem].includes(spec.slice(spec.lastIndexOf("/") + 1));
  for (const [, spec] of text.matchAll(JS_BARE)) if (isHelper(spec)) taken.found = true;
  for (const [, clause, spec] of text.matchAll(JS_FROM)) {
    if (!isHelper(spec)) continue;
    taken.found = true;
    const listed = clause.match(/\{([^}]{0,4096})\}/);
    for (const item of listed ? listed[1].split(",") : []) {
      const [imported, local] = item.trim().split(/\s+as\s+/);
      if (imported) taken.names.set(local ?? imported, imported);
    }
    const all = clause.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
    if (all) taken.modules.push([all[1]]);
    if (/^\s*[A-Za-z_$]/.test(clause.replace(/\{[^}]{0,4096}\}|\*\s*as\s+[\w$]+/g, ""))) return WHOLE;
  }
  return taken;
}

// What the file at `path`, its text `text`, takes from the helper at `helper`, read by its language: { names, star,
// modules }; WHOLE when it takes all of it or its import of the helper is not read.
export function helperBindings(path, text, helper) {
  const name = helper.slice(helper.lastIndexOf("/") + 1);
  const stem = name.replace(/\.[^.]*$/, "");
  if (!PYTHON.test(path) && !JS_TS.test(path)) return WHOLE;
  const taken = PYTHON.test(path) ? pythonBindings(codeMask(path, text), stem) : jsBindings(text, { name, stem });
  return taken === WHOLE || !taken.found ? WHOLE : taken;
}

// Whether `references` use one of a helper's `names` through the `bindings` helperBindings read.
export function usesHelper(bindings, references, names) {
  if (bindings === WHOLE) return true;
  const throughModule = (r) => bindings.modules.some((m) => m.every((p, i) => r[i] === p) && names.has(r[m.length]));
  return references.some((r) => names.has(bindings.names.get(r[0])) || (bindings.star && names.has(r[0])) || throughModule(r));
}
