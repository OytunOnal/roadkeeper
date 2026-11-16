// @level infrastructure
// Roadkeeper — the reader scan: the test files whose own text names a changed file, by its path or, when names count,
// by one of its exported names (reader-rule.mjs), reading only the test files' own text; or, where the project records
// its edges, the test files reaching a changed file through them, reading the test helpers too.
// Every file is read only as a plain file inside the root with no link on the way, up to CAP; a file over it is said,
// its name shown safe, and skipped.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { readPlainFile } from "../../_files.mjs";
import { shownName, workingFile } from "./commit-tree.mjs";
import { exportedNames, namingPattern, readersThroughEdges, testHelpers } from "./reader-rule.mjs";

const CAP = 512 * 1024; // bytes of one file read: many times the largest suite

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

// A reader of files under the root `root` by cappedText: the text of the file at a path, or undefined; the line of
// a file over CAP pushed to `said`.
const textReader = (root, said) => (path) => {
  const got = cappedText(root, path);
  if (got.over) said.push(got.over);
  return got.text;
};

// The reader tests of the `changed` files among the `tests`, both by their paths from the root `root`: { read,
// readers, said }, `read` the count of test files read, `readers` each test file naming a changed file as { file,
// reads }, `reads` the changed paths it names, in the tests' order, `said` a line for each file over CAP. `byNames`:
// whether a changed file's exported names count, else its path alone.
export function readerScan({ root, tests, changed, byNames }) {
  const said = [];
  const textOf = textReader(root, said);
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

// The reader tests of the `changed` files among the `tests` where the project records its `edges` ({ from, to }), by
// imports and paths (reader-rule.mjs, readersThroughEdges): { read, readers, said }, `read` and `said` as readerScan's,
// `readers` each { file, through }. The test files and their helpers are read.
export function readersThrough({ root, tests, changed, edges }) {
  const said = [];
  const textOf = textReader(root, said);
  const texts = new Map();
  const helpers = testHelpers(tests, edges);
  for (const file of [...tests, ...helpers]) {
    const text = textOf(file);
    if (text !== undefined) texts.set(file, text);
  }
  const suites = tests.filter((t) => texts.has(t));
  return { read: suites.length, readers: readersThroughEdges({ changed, suites, edges, helpers, texts }), said };
}

// A change's reader tests among the `tests`, both by their paths from the root `root`: through the edges
// `recordedEdges(root)` reads from the project's structure.json where it records them (readersThrough), else by path and
// exported names (readerScan): { read, readers, said }, as theirs, `said` led by the line saying what structure.json
// left unread. `recordedEdges(root)`: { recorded, edges, unread }.
export function changeReaders({ root, tests, changed, recordedEdges }) {
  const { recorded, edges, unread } = recordedEdges(root);
  const scan = recorded ? readersThrough({ root, tests, changed, edges }) : readerScan({ root, tests, changed, byNames: true });
  const lead = unread ? [`${unread}${recorded ? "" : "; listed by path and exported names"}`] : [];
  return { ...scan, said: [...lead, ...scan.said] };
}
