// @level domain
// Roadkeeper — why Node's runner could not load a test file, read from the run's output. Its JUnit case for such a file
// says only "test failed"; the error Node printed reaches the run's output, and only through a reporter writing there.
// The spec reporter prints each file's error just before that file's `✖ <file>` mark: the file's own block, back to the
// reporter's mark before it. The cause is that block's first error line and, when it does not name the file, the
// block's line naming it, in the order Node printed them. With no mark naming the file (another reporter), the first
// line naming it, and when that is no error line, the first error line after it up to the next mark or line naming a
// file of the run. With no line naming the file, or no error line for it, a fixed line says so. A file is named by its
// path from the tree, with either separator, where a path part starts and ends.

import { escapeForPattern } from "../../../_text.mjs";

const BARE_FAILURE = "test failed"; // the whole detail Node's runner gives a file it could not load
const ERROR_LINE = /^(?:[A-Z]\w*)?(?:Error|Exception)\b/; // an error's first line as Node prints it: "SyntaxError: …", "Error [ERR_…]: …"
const MARK = /^\s*[✔✖▶﹣ℹ]/; // a spec reporter's line: ✔ a pass, ✖ a failure, ▶ a suite, ﹣ a skip, ℹ a count
const FAILED_FILE = /^✖ /; // the spec reporter's ✖ mark of a top-level test, a file it could not load among them
// the detail when no output line names the file: what prints the cause
const NO_LINE_NAMES = "test failed (no line of the run's output names this file: Node's runner prints a load error only "
  + "with a reporter on the output)";
// the detail when the output names the file but prints no error line for it (a thrown string)
const NO_ERROR_LINE = "test failed (the run's output names this file but prints no error line for it)";

// A pattern finding any of the files at `paths`, each written with "/" or "\", where a path part starts and ends.
function filesNamed(paths) {
  const spellings = paths.flatMap((path) => [path, path.replaceAll("/", "\\")]).map(escapeForPattern).join("|");
  return new RegExp(`(?:^|[\\\\/\\s'"(])(?:${spellings})(?![\\w.-])`);
}

// The cause in a file's own block, the lines before its ✖ mark back to the mark before it: its first error line and,
// when that does not name the file, its line naming it, in their order; NO_ERROR_LINE with no error line.
function causeInBlock(lines, markAt, named) {
  const before = lines.slice(0, markAt);
  const block = before.slice(before.findLastIndex((line) => MARK.test(line)) + 1);
  const errorAt = block.findIndex((line) => ERROR_LINE.test(line));
  if (errorAt < 0) return NO_ERROR_LINE;
  const namingAt = named.test(block[errorAt]) ? -1 : block.findIndex((line) => named.test(line));
  return namingAt < 0 ? block[errorAt] : [Math.min(errorAt, namingAt), Math.max(errorAt, namingAt)].map((k) => block[k]).join("\n");
}

// The cause read with no mark naming the file: the first line naming it, alone when it is an error line, else with the
// first error line after it up to the next mark or line naming a file of the run; NO_LINE_NAMES or NO_ERROR_LINE.
function causeAfterNaming(lines, named, anyFile) {
  const at = lines.findIndex((line) => named.test(line));
  if (at < 0) return NO_LINE_NAMES;
  if (ERROR_LINE.test(lines[at])) return lines[at];
  const end = lines.findIndex((line, k) => k > at && (MARK.test(line) || anyFile.test(line)));
  const error = lines.slice(at + 1, end < 0 ? lines.length : end).find((line) => ERROR_LINE.test(line));
  return error === undefined ? NO_ERROR_LINE : `${lines[at]}\n${error}`;
}

// The cause of the test file at `path` failing to load, read from the output of a run given `files`: one line, or two
// joined by a newline; NO_LINE_NAMES or NO_ERROR_LINE when there is none.
export function loadFailureCause(path, { output, files }) {
  const lines = output.split(/\r?\n/);
  const named = filesNamed([path]);
  const markAt = lines.findIndex((line) => FAILED_FILE.test(line) && named.test(line));
  return markAt < 0 ? causeAfterNaming(lines, named, filesNamed([path, ...files])) : causeInBlock(lines, markAt, named);
}

// The case, its detail its load failure's cause (loadFailureCause) when it is a file's case Node's runner failed with
// only "test failed". `run`: { output, files }, the run's output and the files it was given.
export function withLoadCause(testCase, run) {
  const bare = testCase.outcome === "FAIL" && testCase.detail === BARE_FAILURE && testCase.file !== "";
  return bare ? { ...testCase, detail: loadFailureCause(testCase.file, run) } : testCase;
}
