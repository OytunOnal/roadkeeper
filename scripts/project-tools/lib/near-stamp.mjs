// @level infrastructure
// Roadkeeper — the near stamp: the green tree a tree differs from only in files the green does not read
// (read-by-nothing.mjs, its own inputs never among them), the one comparison the green and the landing check share.
// Asks git (scripts/_git.mjs) and reads the clone's green stamp (green-stamp.mjs); writes nothing. A tree git does not
// hold, or a difference over git's output cap or CHANGED_MAX files, does not count.

import { git } from "../../_git.mjs";
import { stampedTrees } from "./green-stamp.mjs";
import { readByNothing } from "./read-by-nothing.mjs";

const CHANGED_MAX = 10000; // files changed between two trees read: a docs-only change is a handful

// The files changed between two trees, or null when git cannot say or they are over CHANGED_MAX.
function changedFiles(root, from, to) {
  let out;
  try { out = git(["diff-tree", "-r", "-z", "--name-only", "--no-renames", from, to], root); } catch { return null; }
  const files = out.split("\0").filter(Boolean);
  return files.length > CHANGED_MAX ? null : files;
}

// The newest tree of the green stamp in `main` that the tree `tree` differs from only in files `patterns` names, or
// null when none does. `place`: { root, main, matches }, the worktree asked, its clone's main checkout, and the
// file-pattern match the patterns read through.
export function nearStamp({ root, main, matches }, tree, patterns) {
  const unreadOnly = (files) => files !== null && files.every((path) => readByNothing(path, patterns, matches));
  return stampedTrees(main).find((stamped) => unreadOnly(changedFiles(root, stamped, tree))) ?? null;
}
