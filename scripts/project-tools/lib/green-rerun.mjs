// @level application
// Roadkeeper — a red green's rerun: whether the tested tree's red run (green-stamp.mjs) may rerun its failed test files,
// by rerun-rule.mjs. The change is the files the tree changes against its merge base with the remote's default branch
// (landing-asks.mjs's remoteHome, origin's default branch as _hook.mjs's `branches` says), their reader tests found as
// reader-tests finds them (reader-scan.mjs). Asks git, reads the red run and the failed files' text through the
// adapters the entry hands in; writes and runs nothing.

import { rerunnable } from "./rerun-rule.mjs";

const REMOTE = "origin"; // the remote whose default branch the change is found against

// The files the tree `tree` changes against its merge base with the remote's default branch, in the worktree at
// `root`: { changed }, or { refusal }, the line saying why they cannot be found.
function changeOf(adapters, root, tree) {
  const { home } = adapters.branches(root);
  const ref = adapters.remoteHome(root, REMOTE, home);
  if (!ref) return { refusal: `no remote default branch (${REMOTE}/${home}) to find the change against; a rerun needs one` };
  const base = adapters.mergeBase(root, ref);
  const changed = base ? adapters.changedFiles(root, base, tree) : null;
  return changed ? { changed } : { refusal: `git could not say what this tree changes against ${ref}` };
}

// The tested tree's red run when it may rerun: { red } (green-stamp.mjs's redRun), or { refusal }, the line saying why
// not (rerun-rule.mjs's rerunnable). `run`: { root, main, tree, tests, recordedEdges, adapters }, the worktree, its
// main checkout, the tested tree, the tests' setup (test-run.mjs's testSetup; null: none), the structure module's
// reading of structure.json's edges, and the git, green stamp, reader scan and test run calls the entry hands in.
export function rerunnableRedRun({ root, main, tree, tests, recordedEdges, adapters }) {
  return rerunnable({
    red: tree ? adapters.redRun(main, tree) : null,
    shortTree: tree ? adapters.shortHash(tree) : "",
    testFiles: () => (tests ? adapters.worktreeTests(tests) : []),
    change: () => changeOf(adapters, root, tree),
    readers: (files, changed) => {
      const runLists = tests ? adapters.worktreeRunLists(tests) : [];
      return adapters.changeReaders({ root, tests: files, changed, recordedEdges, runLists });
    },
  });
}
