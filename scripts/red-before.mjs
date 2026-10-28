#!/usr/bin/env node
// @level main
// Roadkeeper — red-before, today's named test files run on an older commit's code, in a project's worktree:
// `node <roadkeeper>/scripts/red-before.mjs [--root <path>] <commit> <test file> ...`.
//
// Acts on the root of the worktree holding --root's folder, else the directory it is run in (scripts/_root-option.mjs).
// A test file is named by its path from that root. Lays out the commit's files, today's named test files over its own
// and the install linked, in a throwaway folder; runs `beforeTests` there, then `runTests` on the named files, from
// docs/roadkeeper/commands.json; prints each case by name with its outcome, read by the stack's adapter
// (scripts/project-tools/). Which cases had to fail is the reader's to judge.
//
// Exits 0 once the tests ran, whatever their cases said, and on --help; 2 when the commands file refuses (none, no
// `runTests`, no `{files}` in it) or no tree could be built; 3 on a usage error.

import { rootOption } from "./_root-option.mjs";
import { redBefore } from "./project-tools/project-tools.mjs";

const USAGE = "usage: red-before.mjs [--root <path>] <commit> <test file> ..."; // printed on --help and a usage error
const say = (line) => { process.stdout.write(line + "\n"); };

const { root, rest, refused } = rootOption(process.argv.slice(2));
if (rest.includes("--help")) say(USAGE);
else if (refused || rest.length < 2) { say(USAGE); process.exitCode = 3; }
else process.exitCode = await redBefore(root, rest, say);
