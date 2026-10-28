// @level infrastructure
// Roadkeeper — the Python adapter: every test file in one run; its cases are read from the JUnit file the run wrote at
// `{out}` (pytest's `--junitxml={out}`, Roadkeeper's suites' through tests/_case.py), through junit-results.mjs. A case's
// file is its testcase's `file`, made relative to the tree; else the file the run was given whose dotted path (`a/b.py`
// read `a.b`) its classname, or its name when the classname is empty, is or starts with, the longest; else none. Its id
// is its classname's part past that file,
// a class's names, and its own name, joined by "::" as pytest names a test; with no file, its whole classname and its
// name. No install is shared: a linked `.venv` holds an editable install of the main checkout's code. The test files
// are pytest's own. The check at write reads a linter's lines `path:line:col: CODE message`, which ruff, flake8, pylint
// by its template and Roadkeeper's check (scripts/tools/check.py) print.

import { readResultsCases } from "./junit-results.mjs";
import { isUnusedName } from "./lint-message.mjs";

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
  return { file, id, name: id, outcome: raw.outcome, detail: raw.detail };
}

// The cases of a run given `files` in the tree at `root`, read from its JUnit file at `results`: none when it wrote none.
function readRunCases({ root, files, results }) {
  return readResultsCases({ root, results }).map((raw) => readCase(raw, files));
}

// A linter's line: `path:line:col: CODE message`, the column optional; the code's trailing colon, ruff's
// `SyntaxError:`, is no part of it
const LINT_LINE = /^(.+?):(\d+)(?::\d+)?: (\S*[^\s:]):? ?(.*)$/;
// the numbers a message states, `(6 > 5)`, words after them allowed (flake8's `(95 > 79 characters)`)
const FOUND_OVER_LIMIT = /\((\d+) > (\d+)(?: [^()]*)?\)/g;

// A path as a linter prints it, compared with the written file's: `\` read as `/`, a leading `./` dropped.
const isSamePath = (printed, file) => printed.replace(/\\/g, "/").replace(/^\.\//, "") === file;

// [found, limit] the last `(found > limit)` in a message states, or null.
function readStatedNumbers(message) {
  const said = [...message.matchAll(FOUND_OVER_LIMIT)].at(-1);
  return said ? [Number(said[1]), Number(said[2])] : null;
}

// The breaches a lint run printed about `file` as `path:line:col: CODE message` (ruff's `--output-format=concise`,
// flake8's, pylint's by template, Roadkeeper's check's), each { line, rule, numbers }, its unused names aside; lines about
// other files, and its other lines, dropped. null when the run failed with no line about the file: its failure said
// something else (the linter not installed, a crash).
function readLintLineBreaches({ file, output, passed }) {
  const found = [];
  for (const text of output.replace(/\r\n?/g, "\n").split("\n")) {
    const said = LINT_LINE.exec(text);
    if (said && isSamePath(said[1], file)) found.push({ line: Number(said[2]), rule: said[3], numbers: readStatedNumbers(said[4]) });
  }
  if (!passed && !found.length) return null;
  return found.filter((b) => !isUnusedName(b.rule));
}

export const python = {
  install: null,
  tests: ["**/test_*.py", "**/*_test.py"], // pytest's own test files
  filesPerRun: Infinity,
  cases: readRunCases,
  breaches: readLintLineBreaches,
};
