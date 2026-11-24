#!/usr/bin/env node
// @level main
// Roadkeeper — same-cases, whether a change kept every case's outcome, in a project's worktree:
// `node <roadkeeper>/scripts/same-cases.mjs [--root <path>] [--fresh] <commit> [test file ...]`.
//
// Acts on the root of the worktree holding --root's folder, else the directory it is run in (scripts/_root-option.mjs).
// A test file is named by its path from that root; with none, every file the commands file's `tests` pattern matches.
// Only the named files that pattern, else the adapter's, matches run; another named file (a test helper, a probe) runs on
// neither tree, a line saying so; with no named file a test file, no suite runs and the fault names its step, exit 3.
// The commit's tree carries nothing from today.
// Runs `beforeTests`, then `runTests`, from docs/roadkeeper/commands.json, on the commit's tree laid out in a throwaway
// folder, then on the working tree; a base suite with a suite record standing for it (the base's own tree's, or, where
// structure.json records the edges, a tree's differing from the base in no file the suite reaches) is read from it in
// place of running, a line saying so; --fresh runs every base suite. Each suite whose cases all pass or skip writes its
// suite record for its tree, in the main checkout's .run/suite-records/. Compares each case by name, read by the
// stack's adapter (scripts/project-tools/);
// prints "same outcomes" with the counts, or each case whose outcomes differ with both, and under it its failure text,
// crash line or skip reason on each tree. A case of a crashed file (UNKNOWN) on either tree always differs: nothing
// proves it the same.
//
// Exits 0 when every case kept its outcome, and on --help; 1 when one did not, or no file or case was found on either tree; 2
// when the commands file refuses (none, no `runTests`, no `{files}` in it) or no tree could be built; 3 on a usage
// error, no named file a test file included.

import { rootOption } from "./_root-option.mjs";
import { sameCases } from "./project-tools/project-tools.mjs";

const USAGE = "usage: same-cases.mjs [--root <path>] [--fresh] <commit> [test file ...]"; // printed on --help and a usage error
// printed on --help after the usage
const HELP_TESTS_ONLY = "Only the named files the test files' pattern matches run, on each tree; another named file (a test "
  + "helper, a probe) is said once as not run.";
const say = (line) => { process.stdout.write(line + "\n"); };

const { root, rest, refused } = rootOption(process.argv.slice(2));
if (rest.includes("--help")) { say(USAGE); say(HELP_TESTS_ONLY); }
else if (refused || rest.length < 1) { say(USAGE); process.exitCode = 3; }
else process.exitCode = await sameCases(root, rest, say);
