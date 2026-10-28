#!/usr/bin/env node
// @level main
// Roadkeeper — the green, run in a project's worktree: `node <roadkeeper>/scripts/green.mjs [--root <path>]`.
//
// Acts on the root of the worktree holding --root's folder, resolved against the working directory, else the directory
// it is run in (scripts/_root-option.mjs). A project's copy of the plugin's lint rules, roadkeeper-lint/, that differs from
// them turns it red with nothing run, naming scripts/copy-lint-rules.mjs. Runs each `green` step of docs/roadkeeper/commands.json in order, from that root,
// and stops at the first red one with its last lines; then, where the project holds dependency rules, the structure
// check, every hard, unread or stale line red; then writes the green stamp for the tested tree in the main checkout's
// .run/. A tree already stamped is green with nothing run. In a linked worktree with no install, the main checkout's is
// linked in first (scripts/project-tools/).
//
// Exits 0 green, 1 red, 2 refused with nothing run: a usage error, no git repository, no Roadkeeper docs folder, a commands
// file missing or malformed.

import { rootOption } from "./_root-option.mjs";
import { green } from "./project-tools/project-tools.mjs";

const { root, rest, refused } = rootOption(process.argv.slice(2));
if (refused || rest.length) {
  process.stdout.write("usage: green.mjs [--root <path>]\n");
  process.exit(2);
}
process.exitCode = await green(root, (line) => { process.stdout.write(line + "\n"); });
