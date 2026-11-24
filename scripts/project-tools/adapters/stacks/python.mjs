// @level infrastructure
// Roadkeeper — the Python adapter: every test file in one run; its cases are read from the JUnit file the run wrote at
// `{out}` (pytest's `--junitxml={out}`, Roadkeeper's suites' through tests/_case.py), through junit-results.mjs. A case's
// file is its testcase's `file`, made relative to the tree; else the file the run was given whose dotted path (`a/b.py`
// read `a.b`) its classname, or its name when the classname is empty, is or starts with, the longest; else none. Its id
// is its classname's part past that file,
// a class's names, and its own name, joined by "::" as pytest names a test; with no file, its whole classname and its
// name. No install is shared: a linked `.venv` holds an editable install of the main checkout's code. The test files
// are pytest's own. The check at write reads a linter's lines `path:line:col: CODE message`, which ruff, flake8, pylint
// by its template and Roadkeeper's check (scripts/tools/check.py) print, and ESLint's own sentences, which that check
// passes through.

import { caseFromTestcase, readResultsCases } from "./junit-results.mjs";
import { buildLintRead, isUnusedName, markSyntaxError, readEslintCause } from "./lint-message.mjs";

const toDottedPath = (file) => file.replace(/\.py$/, "").replaceAll("/", ".");

// The classname's part past the file's dotted path: "" when it is that path, null when it does not start with it.
function stripFilePath(classname, file) {
  const path = toDottedPath(file);
  if (classname === path) return "";
  return classname.startsWith(path + ".") ? classname.slice(path.length + 1) : null;
}

// The file of `files` whose dotted path the classname is or starts with, the longest; "" for none.
const findClassFile = (classname, files) =>
  files.filter((f) => stripFilePath(classname, f) !== null).sort((a, b) => b.length - a.length)[0] ?? "";

// A JUnit testcase as a case of the run that was given `files`. pytest names a test file it could not collect by its
// dotted path, the classname empty: that case is placed by its name.
function readCase(raw, files) {
  const file = raw.file || findClassFile(raw.classname || raw.name, files);
  const past = file ? stripFilePath(raw.classname, file) ?? raw.classname : raw.classname;
  const classes = file ? past.split(".") : [past];
  const id = [...classes.filter(Boolean), raw.name].join("::");
  return caseFromTestcase(raw, file, id);
}

// The cases of a run given `files` in the tree at `root`, read from its JUnit file at `results`: none when it wrote none.
function readRunCases({ root, files, results }) {
  return readResultsCases({ root, results }).map((raw) => readCase(raw, files));
}

// A linter's line: `path:line:col: CODE message`, the column optional; the code's trailing colon, ruff's
// `SyntaxError:`, is no part of it
const LINT_LINE = /^(.+?):(\d+)(?::\d+)?: (\S*[^\s:]):? ?(.*)$/;
// the codes a file that does not parse is said by: ruff's `SyntaxError:`, flake8's `E999`, pylint's `E0001`, and
// `parse`, Roadkeeper's check's for a Python file and an ESLint parse error it passes through
const SYNTAX_ERRORS = new Set(["SyntaxError", "E999", "E0001", "parse"]);
// the numbers a message states, `(6 > 5)`, words after them allowed (flake8's `(95 > 79 characters)`)
const FOUND_OVER_LIMIT = /\((\d+) > (\d+)(?: [^()]*)?\)/g;

// A path as a linter prints it, compared with the written file's: `\` read as `/`, a leading `./` dropped.
const isSamePath = (printed, file) => printed.replace(/\\/g, "/").replace(/^\.\//, "") === file;

// [found, limit] the last `(found > limit)` in a message states, or null.
function readStatedNumbers(message) {
  const said = [...message.matchAll(FOUND_OVER_LIMIT)].at(-1);
  return said ? [Number(said[1]), Number(said[2])] : null;
}

// A linter's line, matched by LINT_LINE, as a breach: { line, rule, numbers }, marked `syntaxError` when its code says
// the file does not parse.
function readLintLine([, , line, rule, message]) {
  const breach = { line: Number(line), rule, numbers: readStatedNumbers(message) };
  return SYNTAX_ERRORS.has(rule) ? markSyntaxError(breach) : breach;
}

// The breaches a lint run printed about `file` as `path:line:col: CODE message` (ruff's `--output-format=concise`,
// flake8's, pylint's by template, Roadkeeper's check's), each read by readLintLine, its unused names aside; lines about
// other files, and its other lines, dropped: { breaches }; with { cause } beside them when ESLint's own sentence, which
// Roadkeeper's check passes through, names one (lint-message.mjs), alone when there is no breach. { cause: "failed" }
// when the run failed with no line about the file and no such sentence: its failure said something else (the linter
// not installed, a crash).
function readLintLineBreaches({ file, output, passed }) {
  const found = [];
  for (const text of output.replace(/\r\n?/g, "\n").split("\n")) {
    const said = LINT_LINE.exec(text);
    if (said && isSamePath(said[1], file)) found.push(readLintLine(said));
  }
  const breaches = found.filter((b) => !isUnusedName(b.rule));
  return buildLintRead({ breaches, cause: readEslintCause(output), found: found.length, passed });
}

export const python = {
  install: null,
  tests: ["**/test_*.py", "**/*_test.py"], // pytest's own test files
  filesPerRun: Infinity,
  cases: readRunCases,
  breaches: readLintLineBreaches,
};
