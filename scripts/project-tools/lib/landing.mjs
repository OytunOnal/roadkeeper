// @level application
// Roadkeeper — whether a commit may land on the default branch: the remote's default branch already holds it, or its
// state lets it (landing-state.mjs); the refusal of one that may not, which the merge guard and Roadkeeper's pre-push
// both give. Asks git and reads the clone's green stamp through the adapters the entry hands in; writes nothing and
// runs nothing else.

import { landingState, refusalFor } from "./landing-state.mjs";

// The refusal of the first of `commits` (full hashes) that may not land, null when each may. `place`: { root, main,
// matches, adapters, runGreen }, the worktree, its main checkout, whose .run/ holds the green stamp, the file-pattern
// match, the git and green stamp calls the entry hands in, and the line a refusal ends on; `landing`: { remote, home,
// commits, patterns }, the remote they land on and its default branch, and the commands file's readByNothing
// (landingState's).
export function landingRefusal(place, { remote, home, commits, patterns }) {
  const { root, main, adapters } = place;
  const tracking = adapters.remoteHome(root, remote, home);
  for (const commit of commits) {
    if (tracking && adapters.remoteHolds(root, tracking, commit)) continue;
    const state = landingState({
      tree: () => { try { return adapters.treeOf(root, commit); } catch { return null; } },
      stamped: (tree) => adapters.stampedRecord(main, tree),
      near: (tree) => adapters.nearStamp(place, tree, patterns),
    }, patterns);
    if (state !== "green") return refusalFor(state, adapters.shortHash(commit), place.runGreen);
  }
  return null;
}
