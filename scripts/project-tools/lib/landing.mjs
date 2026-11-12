// @level infrastructure
// Roadkeeper — whether a commit may land on the default branch: the remote's default branch already holds it, its tree holds
// a green stamp, or, in a project whose commands file names no doc tests, it differs from a stamped tree only in files
// the green does not read (near-stamp.mjs); and the refusal, in fixed words, of one that may not, which the merge guard
// and Roadkeeper's pre-push both give. Asks git (scripts/_git.mjs) and reads the clone's green stamp (green-stamp.mjs);
// writes nothing and runs nothing else.

import { fileURLToPath } from "node:url";
import { git } from "../../_git.mjs";
import { stampedRecord } from "./green-stamp.mjs";
import { nearStamp } from "./near-stamp.mjs";

const GREEN = fileURLToPath(new URL("../../green.mjs", import.meta.url)); // the plugin's green, which a refusal names
// what every refusal ends on: the plugin's green and where to run it
export const RUN_GREEN = `run \`node "${GREEN}"\` in the worktree holding it, then try again`;

// a landing's patterns where a commit lands only on its own stamp: no near stamp is looked for
export const OWN_STAMP_ONLY = null;

// One git answer in the worktree, or "" when git fails.
const ask = (root, args) => { try { return git(args, root); } catch { return ""; } };

// The commit's state in the worktree at `place.root`, whose clone's green stamp is in `place.main`: "green",
// "unstamped", "unrun" when unstamped and no near stamp is looked for, or "missing" when the clone holds no such
// commit. `commit`: a full hash; `patterns`: the commands file's readByNothing, read through `place.matches`, the
// file-pattern match; OWN_STAMP_ONLY: a commit lands only on its own stamp.
function landingState(place, commit, patterns) {
  let tree;
  try { tree = git(["rev-parse", "--verify", "-q", `${commit}^{tree}`], place.root); } catch { return "missing"; }
  if (stampedRecord(place.main, tree)) return "green";
  if (patterns === OWN_STAMP_ONLY) return "unrun";
  return nearStamp(place, tree, patterns) ? "green" : "unstamped";
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
  if (state === "unrun") return `commit ${short} has not run green; ${RUN_GREEN}`;
  return `commit ${short} has not run green, and differs from every green tree in files the green reads; ${RUN_GREEN}`;
}

// The refusal of the first of `commits` (full hashes) that may not land, null when each may. `place`: { root, main,
// matches }, as landingState's; `landing`: { remote, home, commits, patterns }, the remote they land on and its default
// branch, and the commands file's readByNothing (OWN_STAMP_ONLY: none looked at, as landingState's).
export function landingRefusal(place, { remote, home, commits, patterns }) {
  const tracking = remoteHome(place.root, remote, home);
  for (const commit of commits) {
    if (tracking && remoteHolds(place.root, tracking, commit)) continue;
    const state = landingState(place, commit, patterns);
    if (state !== "green") return refusalFor(state, commit);
  }
  return null;
}
