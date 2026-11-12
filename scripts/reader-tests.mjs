#!/usr/bin/env node
// @level main
// Roadkeeper — reader-tests, the tests that read a change, in a project's worktree:
// `node <roadkeeper>/scripts/reader-tests.mjs [--root <path>] [--run] [file ...]`.
//
// Acts on the root of the worktree holding --root's folder, else the directory it is run in (scripts/_root-option.mjs).
// A file is named by its path from that root; with none named, the change is the uncommitted one: staged, unstaged and
// untracked. Prints the reader tests, the test files whose own text names a changed file's path, by its parts in order,
// or one of its exported names as a whole word, one a line, sorted by path; then a line counting the test files read
// and the readers found. The test files are those docs/roadkeeper/commands.json's `tests`, else the stack's
// adapter's, matches, each a plain file inside the root up to a cap; one over it is said and skipped; helpers they
// import are not followed (scripts/project-tools/). `--run` runs them through `runTests` as the green's `{tests}`
// step does, its output as that step's, ending on "N reader tests run; not the green". It writes no green stamp.
//
// Exits 0 listed, or run with every case passing; 1 when a run case failed; 2 refused: a usage error, no git
// repository, a commands file missing, malformed or with no `runTests`, a file named outside the root.

import { rootOption } from "./_root-option.mjs";
import { READER_TESTS_RUN, readerTests } from "./project-tools/project-tools.mjs";

const USAGE = `usage: reader-tests.mjs [--root <path>] [${READER_TESTS_RUN}] [file ...]`; // printed on --help and a usage error
const say = (line) => { process.stdout.write(line + "\n"); };

const { root, rest, refused } = rootOption(process.argv.slice(2));
const unknown = rest.some((a) => a.startsWith("-") && a !== READER_TESTS_RUN && a !== "--help");
if (rest.includes("--help")) say(USAGE);
else if (refused || unknown) { say(USAGE); process.exitCode = 2; }
else process.exitCode = await readerTests(root, rest, say);
