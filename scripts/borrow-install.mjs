#!/usr/bin/env node
// @level main
// Roadkeeper — the borrowed install, run in a project's worktree before any suite:
// `node <roadkeeper>/scripts/borrow-install.mjs [--root <path>]`.
//
// Acts on the root of the worktree holding --root's folder, resolved against the working directory, else the directory
// it is run in (scripts/_root-option.mjs). In a linked worktree with no install of its own, the install folder
// docs/roadkeeper/commands.json names (the stack's when left out) is linked in from the main checkout while the two
// checkouts' package-lock.json beside it match byte for byte; a link to the main checkout's install laid before is
// removed once they differ (scripts/project-tools/). Asks git for the main checkout; writes only that link.
//
// Prints one line, `borrow-install: …`. Exits 0 with an install there to use, 1 with none (install in the worktree, or in
// the main checkout), 2 refused with nothing done: a usage error, no git repository, a commands file missing or malformed.

import { rootOption } from "./_root-option.mjs";
import { linkInstall } from "./project-tools/project-tools.mjs";

const { root, rest, refused } = rootOption(process.argv.slice(2));
if (refused || rest.length > 0) {
  process.stdout.write("usage: borrow-install.mjs [--root <path>]\n");
  process.exit(2);
}
process.exitCode = linkInstall(root, (line) => { process.stdout.write(line + "\n"); });
