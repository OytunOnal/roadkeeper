// @level infrastructure
// Roadkeeper — what the landing check and a green's rerun ask git of the remote's default branch: its remote-tracking
// ref, whether it already holds a commit, and the merge base with it; and the plugin's green a landing refusal names.

import { fileURLToPath } from "node:url";
import { git, gitWithin } from "../../_git.mjs";
import { listingLimit } from "./commit-tree.mjs";

const GREEN = fileURLToPath(new URL("../../green.mjs", import.meta.url)); // the plugin's green, which a refusal names
// what every refusal ends on: the plugin's green and where to run it
export const RUN_GREEN = `run \`node "${GREEN}"\` in the worktree holding it, then try again`;

// One git answer in the worktree, or "" when git fails.
const ask = (root, args) => { try { return git(args, root); } catch { return ""; } };

// The remote-tracking ref of the remote `remote`'s default branch `home`, or "" when the remote's name can hold none or
// the clone holds none.
export function remoteHome(root, remote, home) {
  const ref = `refs/remotes/${remote}/${home}`;
  const valid = remote && ask(root, ["check-ref-format", "--print", ref]) === ref;
  return valid && ask(root, ["rev-parse", "--verify", "-q", ref]) ? ref : "";
}

// Whether the remote-tracking ref already holds the commit: it has landed before. The walk grows with the history, under
// git's fixed GIT_TIMEOUT: measured at 3.5 microseconds a small commit without a commit-graph, twice that allowed for real
// ones, it reaches the limit only past about 1.4 million commits; a call that times out reads as not held, so only an unstamped commit the remote holds is then refused.
export const remoteHolds = (root, ref, commit) => { try { git(["merge-base", "--is-ancestor", commit, ref], root); return true; } catch { return false; } };

// The merge base of the ref `ref` and HEAD in the worktree at `root`, bounded as a git listing (listingLimit); "" when
// git cannot say.
export function mergeBase(root, ref) {
  try { return gitWithin(["merge-base", ref, "HEAD"], root, { timeout: listingLimit(root) }); } catch { return ""; }
}
