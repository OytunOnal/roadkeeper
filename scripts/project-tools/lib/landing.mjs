// @level infrastructure
// Roadkeeper — whether a commit may land on the default branch: the remote's default branch already holds it, its tree holds
// a green stamp, or it differs from a stamped tree only in files the green does not read (lib/read-by-nothing.mjs, its
// own inputs never among them); and the refusal, in fixed words, of one that may not, which the merge guard and
// Roadkeeper's pre-push both give. Asks git (scripts/_git.mjs) and reads the clone's green stamp (lib/green-stamp.mjs);
// writes nothing and runs nothing else. A stamped tree git does not hold, or a difference over git's output cap or
// CHANGED_MAX files, does not count.

import { fileURLToPath } from "node:url";
import { git } from "../../_git.mjs";
import { stampedRecord, stampedTrees } from "./green-stamp.mjs";
import { readByNothing } from "./read-by-nothing.mjs";

const CHANGED_MAX = 10000; // files changed between two trees read: a docs-only change is a handful
const GREEN = fileURLToPath(new URL("../../green.mjs", import.meta.url)); // the plugin's green, which a refusal names
// what every refusal ends on: the plugin's green and where to run it
export const RUN_GREEN = `run \`node "${GREEN}"\` in the worktree holding it, then try again`;

// One git answer in the worktree, or "" when git fails.
const ask = (root, args) => { try { return git(args, root); } catch { return ""; } };

// The files changed between two trees, or null when git cannot say or they are over CHANGED_MAX.
function changedFiles(root, from, to) {
  let out;
  try { out = git(["diff-tree", "-r", "-z", "--name-only", "--no-renames", from, to], root); } catch { return null; }
  const files = out.split("\0").filter(Boolean);
  return files.length > CHANGED_MAX ? null : files;
}

// The commit's state in the worktree at `root`, whose clone's green stamp is in `main`: "green", "unstamped", or
// "missing" when the clone holds no such commit. `commit`: a full hash; `patterns`: the commands file's readByNothing,
// read through `matches`, the file-pattern match.
function landingState({ root, main, matches }, commit, patterns) {
  let tree;
  try { tree = git(["rev-parse", "--verify", "-q", `${commit}^{tree}`], root); } catch { return "missing"; }
  if (stampedRecord(main, tree)) return "green";
  const unreadOnly = (files) => files !== null && files.every((path) => readByNothing(path, patterns, matches));
  const near = stampedTrees(main).some((stamped) => unreadOnly(changedFiles(root, stamped, tree)));
  return near ? "green" : "unstamped";
}

// The remote-tracking ref of the remote `remote`'s default branch `home`, or "" when the remote's name can hold none or
// the clone holds none.
export function remoteHome(root, remote, home) {
  const ref = `refs/remotes/${remote}/${home}`;
  const valid = remote && ask(root, ["check-ref-format", "--print", ref]) === ref;
  return valid && ask(root, ["rev-parse", "--verify", "-q", ref]) ? ref : "";
}

// whether the remote-tracking ref already holds the commit: it has landed before
const remoteHolds = (root, ref, commit) => { try { git(["merge-base", "--is-ancestor", commit, ref], root); return true; } catch { return false; } };

// The refusal for a commit that is not green, by its state (landingState).
function refusalFor(state, commit) {
  const short = commit.slice(0, 12);
  if (state === "missing") return `commit ${short} is not in this clone; fetch it, then ${RUN_GREEN}`;
  return `commit ${short} has not run green, and differs from every green tree in files the green reads; ${RUN_GREEN}`;
}

// The refusal of the first of `commits` (full hashes) that may not land, null when each may. `place`: { root, main,
// matches }, as landingState's; `landing`: { remote, home, commits, patterns }, the remote they land on and its default
// branch, and the commands file's readByNothing.
export function landingRefusal(place, { remote, home, commits, patterns }) {
  const tracking = remoteHome(place.root, remote, home);
  for (const commit of commits) {
    if (tracking && remoteHolds(place.root, tracking, commit)) continue;
    const state = landingState(place, commit, patterns);
    if (state !== "green") return refusalFor(state, commit);
  }
  return null;
}
