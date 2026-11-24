// @level application
// Roadkeeper — red-before: today's named test files run on an older commit's code. The tree, in a throwaway folder of
// the OS temp folder (commit-tree.mjs), holds the commit's files, its other test files kept, so a suite reading them
// finds them; over them today's named files, and today's copy of each test helper the named test files reach through
// the edges the worktree's structure.json records (reader-rule.mjs) that the commit holds and the map gives no level,
// a line naming those differing from the commit's; the install, the worktree's own, else its main checkout's, linked
// in; beside it, each sibling today's package.json names, said before the cases, linked or not. There `beforeTests`
// runs, then `runTests` (test-run.mjs) on the named test files alone: a named file the test files' pattern does not
// match (a test helper, a probe) is laid and not run, a line saying so. Prints each named test file's cases by name
// with their outcomes, a failing or skipped case's detail under it, a crashed file's cases UNKNOWN under its line
// naming the crash, then the counts. Git, the commit tree and the test run are reached only through the adapters the
// entry hands in.
//
// Exits 0 once the tests ran, whatever their cases said; 2 when the commands file refuses or no tree could be built; 3
// when a named file is no plain file of the working tree, or no named file is a test file.

import { plural } from "../../_text.mjs";
import { helpersReached, testHelpers } from "./reader-rule.mjs";
import { shownName } from "./shown-name.mjs";

// The test helpers the named test files `tests` reach through the edges `recordedEdges(root)` reads from the
// worktree's structure.json, helpers of helpers included, as reader-tests reads them, but a file the map gives a level,
// the code under test, and the `named` files: those on disk, by path; none where it records none. { reached, unread },
// `unread` the line saying what it left unread, or null.
function reachedHelpers(setup, { tests, named, recordedEdges, adapters }) {
  const { recorded, edges, levelled, unread } = recordedEdges(setup.root);
  if (!recorded) return { reached: [], unread };
  const [isNamed, isLevelled] = [new Set(named), new Set(levelled)];
  const helpers = testHelpers(adapters.worktreeTests(setup), edges).filter((f) => !isLevelled.has(f));
  const reached = helpersReached(tests, edges, helpers);
  return { reached: reached.filter((f) => !isNamed.has(f) && adapters.workingFile(setup.root, f)), unread };
}

// The test helpers carried from today: of those reachedHelpers finds, the ones the commit `hash` holds, { held,
// differing, unread } (heldByCommit's, with reachedHelpers' `unread`); or { stopped, unread }, `stopped` saying the git
// call that failed comparing them.
function carriedHelpers(setup, hash, reach) {
  const { reached, unread } = reachedHelpers(setup, reach);
  try { return { ...reach.adapters.heldByCommit(setup.root, hash, reached), unread }; } catch (e) { return { stopped: e.message, unread }; }
}

// Red-before of the worktree holding `dir`, on the commit and test files `args` name, each line handed to `say`: a
// promise of the exit code. `call`: { dir, args, matches, recordedEdges, words, adapters }, `matches(pattern, path)` the
// test-file pattern's reading, `recordedEdges(root)` the edges the project's structure.json records: { recorded, edges,
// levelled, unread }; `words` the lines the runs say (testSetup's), the cases' among them; `adapters` the git, commit
// tree and test run calls the entry hands in.
export async function redBefore(call, say) {
  const { adapters } = call;
  const { testSetup, workingFile, namedCommit, namedFilesSplit, inCommitTree, shortHash, treeCases } = adapters;
  const [commit, ...names] = call.args;
  const setup = testSetup(call);
  if (setup.refused) { say(`red-before: ${setup.refused}`); return 2; }
  const files = names.map((n) => workingFile(setup.root, n));
  const missing = names.find((n, k) => !files[k]);
  if (missing !== undefined) { say(`red-before: ${shownName(missing)} is not a plain file in the working tree`); return 3; }
  const hash = namedCommit({ root: setup.root, name: commit, label: "red-before" }, say);
  if (!hash) return 2;
  const named = [...new Set(files)];
  const { tests, notTests, fault } = namedFilesSplit(setup, named, "red-before");
  if (fault) { for (const line of fault) say(line); return 3; }
  if (setup.said) say(`red-before: ${setup.said}`);
  const carried = carriedHelpers(setup, hash, { tests, named, recordedEdges: call.recordedEdges, adapters });
  if (carried.unread) say(`red-before: ${carried.unread}`);
  if (carried.stopped) { say(`red-before: no tree built: git could not lay out the commit: ${carried.stopped}`); return 2; }
  const plan = { hash, copied: [...named, ...carried.held], install: setup.commands.install, installFrom: setup.installFrom };
  return inCommitTree({ root: setup.root, label: "red-before", plan }, say, async (scratch) => {
    say(`red-before: ${shortHash(hash)}'s code, ${plural(named.length, "named file")}`);
    const { differing } = carried;
    if (differing.length) say(`red-before: ${plural(differing.length, "helper")} laid from today: ${differing.map(shownName).join(", ")}`);
    for (const f of notTests) say(`red-before: ${shownName(f)} laid from today, not run: not a test file`);
    const cases = await treeCases({ ...setup, tree: scratch.tree, files: tests, results: scratch.results, label: "red-before" }, say);
    for (const line of setup.words.listedByFile(cases)) say(line);
    say(`red-before: ${setup.words.counted(cases)}`);
    return 0;
  });
}
