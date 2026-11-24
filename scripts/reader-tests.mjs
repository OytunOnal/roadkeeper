#!/usr/bin/env node
// @level main
// Roadkeeper — reader-tests, the tests that read a change, in a project's worktree:
// `node <roadkeeper>/scripts/reader-tests.mjs [--root <path>] [--run] [file ...]`.
//
// Acts on the root of the worktree holding --root's folder, else the directory it is run in (scripts/_root-option.mjs).
// A file is named by its path from that root; with none named, the change is the uncommitted one: staged, unstaged and
// untracked. Prints the reader tests, one a line, sorted by path; then a line counting the test files read and the
// readers found. Where docs/roadkeeper/structure.json records the project's edges, as its file stands: the test files
// that are a changed file, or import or name by its path a file reaching one through the edges (its importers, theirs,
// up to the top) or through a test helper (a file only test files and other helpers import) naming such a file by its
// path, a test file reaching through it only when it uses the helper's top-level function, class or constant whose
// definition names the file, or uses one that does, followed within the helper (a top-level statement outside any
// definition naming it counts for every importer), or through a run list commands.json's `runLists` declares (a file
// listing commands a test runs) naming such a file by its path;
// each followed by `  (through <file>)`, the one of those it imports or names nearest a changed file, when that
// is not a changed file itself; edges structure.json holds but cannot be read are said first, by their count. Else the
// test files whose own text names a changed file's path, by its parts in order, or one of its exported names as a whole
// word; a declared structure whose structure.json cannot be read is said first. On both, a path written as a plain
// string counts, and a bare file name for a file of that name in the naming file's own folder; any other bare name,
// and a comment or docstring, name nothing; a script another script starts, by its path or a sibling name rather than
// an import, is not seen. The test files are those
// docs/roadkeeper/commands.json's `tests`, else the stack's adapter's, matches, each a plain file inside the root up to
// a cap; one over it is said and skipped (scripts/project-tools/). `--run` runs them through `runTests` as the green's
// `{tests}` step does, its output as that step's, ending on "N reader tests run; not the green". It writes no green
// stamp.
//
// Exits 0 listed, or run with every case passing; 1 when a run case failed; 2 refused: a usage error, no git
// repository, a commands file missing, malformed or with no `runTests`, a file named outside the root, a path named
// that is neither on disk nor in the last commit (a file the change deletes still lists its readers), or no file named
// on a tree with no uncommitted change.

import { rootOption } from "./_root-option.mjs";
import { READER_TESTS_RUN, readerTests } from "./project-tools/project-tools.mjs";

const USAGE = `usage: reader-tests.mjs [--root <path>] [${READER_TESTS_RUN}] [file ...]`; // printed on --help and a usage error
const say = (line) => { process.stdout.write(line + "\n"); };

const { root, rest, refused } = rootOption(process.argv.slice(2));
const unknown = rest.some((a) => a.startsWith("-") && a !== READER_TESTS_RUN && a !== "--help");
if (rest.includes("--help")) say(USAGE);
else if (refused || unknown) { say(USAGE); process.exitCode = 2; }
else process.exitCode = await readerTests(root, rest, say);
