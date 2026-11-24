// @level kernel
// Roadkeeper — a Python or JS/TS file's text lexed: its comments, a Python string statement that is a module's, a
// function's or a class's first statement (its docstring), and its strings, each read once, linearly; the code with its
// strings put out; and what code is read by: a file's language by its name, the spaces between a line's tokens, a
// bracket depth. Pure: the texts are the caller's.

export const JS_TS = /\.(?:[cm]?[jt]s|[jt]sx)$/; // a JS/TS file, by its name
export const PYTHON = /\.py$/;                   // a Python file, by its name
const PY_DEFINES = /(?:async[ \t]+)?(?:def|class)\b/y; // a logical line opening a function or a class, read at its start
const PY_PREFIX = /^[rRbBuUfF]{0,2}$/;                  // what may stand before a Python string's quote
const PY_STATEMENT_ENDS = /[ \t]*(?:[\r\n#;]|$)/y;      // a statement ending after a string, so the string is all of it
export const SPACE = new Set([" ", "\t", "\r", "\f"]);  // what a line holds between its tokens

// The bracket depth after the character `c`, from `depth` before it: one more after an opening bracket, one fewer after
// a closing one, never below 0.
export function bracketDepth(depth, c) {
  return Math.max(0, depth + ("([{".includes(c) ? 1 : 0) - (")]}".includes(c) ? 1 : 0));
}

// The end of the text's line holding `i`: its newline's index, else the text's length.
function lineEnd(text, i) {
  const end = text.indexOf("\n", i);
  return end < 0 ? text.length : end;
}

// The index after the string whose quote, `close`, starts at `i`, closed by the same `close`; an unclosed one ends at
// its line's end, or at the text's end when `close` is a triple quote, which spans lines.
function stringEnd(text, i, close) {
  let k = i + close.length;
  while (k < text.length && !text.startsWith(close, k)) {
    if (close.length < 3 && text[k] === "\n") return k;
    k += text[k] === "\\" ? 2 : 1;
  }
  return Math.min(k + close.length, text.length);
}

// The index after the Python string whose quote starts at `i`, a triple quote or a single one.
function pythonStringEnd(text, i) {
  const triple = text[i].repeat(3);
  return stringEnd(text, i, text.startsWith(triple, i) ? triple : text[i]);
}

// A Python logical line started at `i`, `docAllowed` carried from the line before: { start, defines, docAllowed },
// `defines` whether it opens a def or a class.
function logicalLine(text, i, docAllowed) {
  PY_DEFINES.lastIndex = i;
  return { start: i, defines: PY_DEFINES.test(text), docAllowed };
}

// Whether the Python string at `[quote, end)` is a docstring: the first statement of its logical line `line`, where
// one is allowed, nothing but a prefix before its quote, nothing after it but the statement's end.
function isDocstring(text, line, [quote, end]) {
  PY_STATEMENT_ENDS.lastIndex = end;
  const prefixed = quote - line.start <= 2 && PY_PREFIX.test(text.slice(line.start, quote));
  return line.docAllowed && prefixed && PY_STATEMENT_ENDS.test(text);
}

// The parts of a Python text, each [start, end), in order: { comments, docstrings, strings }, `comments` its `#`
// comments, `docstrings` each string statement that is a module's, a function's or a class's first statement, from
// its prefix; `strings` its strings.
function findPythonParts(text) {
  const comments = [];
  const docstrings = [];
  const strings = [];
  let line = { start: -1, defines: false, docAllowed: true };
  let depth = 0; // brackets open, inside which a newline ends no logical line
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "#") { comments.push([i, lineEnd(text, i)]); i = lineEnd(text, i); continue; }
    const endsLogicalLine = c === "\n" && depth === 0 && line.start >= 0;
    if (endsLogicalLine) line = { start: -1, defines: false, docAllowed: line.defines };
    if (SPACE.has(c) || c === "\n") { i += 1; continue; }
    if (c === "\\") { i += 2; continue; }
    if (line.start < 0) line = logicalLine(text, i, line.docAllowed);
    if (c === '"' || c === "'") {
      const end = pythonStringEnd(text, i);
      strings.push([i, end]);
      if (isDocstring(text, line, [i, end])) docstrings.push([line.start, end]);
      i = end;
      continue;
    }
    depth = bracketDepth(depth, c);
    i += 1;
  }
  return { comments, docstrings, strings };
}

// The index after the JS template text from `i`, inside a template: { end, opensExpression }, `end` after its closing
// backtick, or after a `${` when it `opensExpression`.
function templateEnd(text, i) {
  let k = i;
  while (k < text.length) {
    if (text[k] === "`") return { end: k + 1, opensExpression: false };
    if (text.startsWith("${", k)) return { end: k + 2, opensExpression: true };
    k += text[k] === "\\" ? 2 : 1;
  }
  return { end: text.length, opensExpression: false };
}

// The end of the JS comment starting at `i`, a line one (`//`) or a block one (`/*`), its text's end when unclosed.
function jsCommentEnd(text, i) {
  if (text[i + 1] === "/") return lineEnd(text, i);
  const close = text.indexOf("*/", i + 2);
  return close < 0 ? text.length : close + 2;
}

// The parts of a JS or TS text, each [start, end), in order: { comments, docstrings, strings }, `comments` its line and
// block comments, `docstrings` none; `strings` its strings, and each template's text outside its `${ … }`. A template's
// `${ … }` is read as code, its braces counted so its closing one goes back into the template.
function findJsParts(text) {
  const comments = [];
  const strings = [];
  const braces = []; // for each template expression open, the braces opened inside it
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const isComment = c === "/" && (text[i + 1] === "/" || text[i + 1] === "*");
    const closesExpression = c === "}" && braces.at(-1) === 0;
    if (isComment) { comments.push([i, jsCommentEnd(text, i)]); i = jsCommentEnd(text, i); continue; }
    if (c === "\\") { i += 2; continue; }
    if (c === '"' || c === "'") { strings.push([i, stringEnd(text, i, c)]); i = stringEnd(text, i, c); continue; }
    if (c === "`" || closesExpression) {
      if (closesExpression) braces.pop();
      const { end, opensExpression } = templateEnd(text, i + 1);
      if (opensExpression) braces.push(0);
      strings.push([i, end]);
      i = end;
      continue;
    }
    const isBraceInExpression = braces.length > 0 && (c === "{" || c === "}");
    if (isBraceInExpression) braces[braces.length - 1] += c === "{" ? 1 : -1;
    i += 1;
  }
  return { comments, docstrings: [], strings };
}

// The parts of the file at `path`, its text `text`, read by its kind (findPythonParts, findJsParts): { comments,
// docstrings, strings }, each [start, end) in order; none for another kind of file.
export function sourceParts(path, text) {
  if (PYTHON.test(path)) return findPythonParts(text);
  if (JS_TS.test(path)) return findJsParts(text);
  return { comments: [], docstrings: [], strings: [] };
}

// The `text` with each of its `parts` ([start, end), in order) put out by `filler(start, end)`'s text.
export function replaceParts(text, parts, filler) {
  let kept = "";
  let from = 0;
  for (const [start, end] of parts) {
    kept += text.slice(from, start) + filler(start, end);
    from = end;
  }
  return kept + text.slice(from);
}

// The code of the file at `path`, its text `text`: each of a Python or JS/TS file's strings put out by as many spaces,
// so what is left is code at the places it stands; any other file's text whole.
export function codeMask(path, text) {
  return replaceParts(text, sourceParts(path, text).strings, (start, end) => " ".repeat(end - start));
}
