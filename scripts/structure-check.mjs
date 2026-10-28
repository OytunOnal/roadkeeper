#!/usr/bin/env node
// @level main
// Roadkeeper — the structure check, run on a project's tree:
// `node <roadkeeper>/scripts/structure-check.mjs [--root <path>] [--stamping vX.Y.Z]`.
//
// Acts on the tree --root names, resolved against the working directory, else the directory it is run in
// (scripts/_root-option.mjs).
// Prints the structure report's lines (scripts/structure/, `report`), over the tracker snapshot read offline
// (scripts/_tracker.mjs: docs/roadkeeper/issues.json, for the closed milestones; the tree's own, else, in a linked worktree,
// its main checkout's) and today. Asks git only where the main checkout is, and only when the tree holds no snapshot;
// writes nothing.
//
// Exits 1 on a hard, unread or stale line; 2 on a usage error, a --root with no value, given twice or naming no
// directory included; 0 otherwise. `--stamping` lines never change the exit; under `--stamping`, no snapshot read is an unread line, not a
// note.
// What it cannot see: the digest proves structure.json was stamped from these files, not that its edges are true.

import { todayLocal } from "./_clock.mjs";
import { rootOption } from "./_root-option.mjs";
import { VERSION_TOKEN } from "./_text.mjs";
import { readTracker } from "./_tracker.mjs";
import { report } from "./structure/structure.mjs";

// { stamping } from the arguments but --root's, or null on a usage error. `stamping` is the version a stamp is about to
// write, when the stamp runs the check first; null when not given.
function parseArgs(args) {
  if (args.length === 0) return { stamping: null };
  const versioned = args.length === 2 && args[0] === "--stamping" && VERSION_TOKEN.test(args[1]);
  return versioned ? { stamping: args[1] } : null;
}

const { root, rest, refused } = rootOption(process.argv.slice(2));
const opts = refused ? null : parseArgs(rest);
if (!opts) {
  process.stdout.write("usage: structure-check.mjs [--root <path>] [--stamping vX.Y.Z]\n");
  process.exit(2);
}

const { stamping } = opts;
const said = report(root, { snapshot: readTracker(root, true).snap, today: todayLocal(), stamping, snapshotOptional: stamping === null });
process.stdout.write(said.lines.join("\n") + "\n");
process.exit(said.failed ? 1 : 0);
