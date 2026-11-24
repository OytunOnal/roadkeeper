#!/usr/bin/env node
// @level main
// Roadkeeper — red-before, today's named test files run on an older commit's code, in a project's worktree:
// `node <roadkeeper>/scripts/red-before.mjs [--root <path>] <commit> <test file> ...`.
//
// Acts on the root of the worktree holding --root's folder, else the directory it is run in (scripts/_root-option.mjs).
// A test file is named by its path from that root. In a throwaway folder it lays out the commit's files, with today's
// named files and the test helpers HELP_LAID_FILES says over them, and links the install in; there it runs
// `beforeTests`, then `runTests` on the named test files, both from docs/roadkeeper/commands.json, and prints each case
// by name with its outcome, read by the stack's adapter (scripts/project-tools/): UNKNOWN for a case
// of a file the run's failure of no named file names, or of every file when that failure names no file holding cases,
// or of a file whose own run, alone, has such a failure. Which cases had to fail is the reader's to judge.
//
// Exits 0 once the tests ran, whatever their cases said, and on --help; 2 when the commands file refuses (none, no
// `runTests`, no `{files}` in it) or no tree could be built; 3 on a usage error, no named file a test file included.

import { rootOption } from "./_root-option.mjs";
import { redBefore } from "./project-tools/project-tools.mjs";

const USAGE = "usage: red-before.mjs [--root <path>] <commit> <test file> ..."; // printed on --help and a usage error
// printed on --help after the usage
const HELP_LAID_FILES = "The test helpers the named tests reach through structure.json's edges are laid from today, "
  + "those differing from the commit's named in one line, when the commit holds them at their path and the map gives "
  + "them no level; a file with a level is code under test, never laid. A helper new or moved since the commit, one "
  + "reached by an import line this change adds, or any with no structure.json, is named beside its suite; a named "
  + "file outside the test files' pattern is laid from today and not run.";
const say = (line) => { process.stdout.write(line + "\n"); };

const { root, rest, refused } = rootOption(process.argv.slice(2));
if (rest.includes("--help")) { say(USAGE); say(HELP_LAID_FILES); }
else if (refused || rest.length < 2) { say(USAGE); process.exitCode = 3; }
else process.exitCode = await redBefore(root, rest, say);
