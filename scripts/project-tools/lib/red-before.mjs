// @level infrastructure
// Roadkeeper — red-before: today's named test files run on an older commit's code. The tree, in a throwaway folder of the OS
// temp folder (commit-tree.mjs): the commit's files, its other test files kept, so a suite reading them finds them;
// today's named test files over its own; the install linked in, the worktree's own, else its main checkout's; beside
// it, each sibling today's package.json names, said before the cases, linked or not. There `beforeTests` runs, then
// `runTests` (test-run.mjs) on the named files alone. Prints each named file's cases by name with their outcomes, a
// failing or skipped case's detail under it, then the counts.
//
// Exits 0 once the tests ran, whatever their cases said; 2 when the commands file refuses or no tree could be built; 3
// when a named file is no plain file of the working tree.

import { plural } from "../../_text.mjs";
import { counted, listedByFile } from "./case-outcomes.mjs";
import { inCommitTree, namedCommit, shownName, workingFile } from "./commit-tree.mjs";
import { testSetup, treeCases } from "./test-run.mjs";

// Red-before of the worktree holding `dir`, on the commit and test files `args` name, each line handed to `say`: a
// promise of the exit code. `call`: { dir, args, matches }, `matches(pattern, path)` the test-file pattern's reading.
export async function redBefore(call, say) {
  const [commit, ...names] = call.args;
  const setup = testSetup(call);
  if (setup.refused) { say(`red-before: ${setup.refused}`); return 2; }
  const files = names.map((n) => workingFile(setup.root, n));
  const missing = names.find((n, k) => !files[k]);
  if (missing !== undefined) { say(`red-before: ${shownName(missing)} is not a plain file in the working tree`); return 3; }
  const hash = namedCommit({ root: setup.root, name: commit, label: "red-before" }, say);
  if (!hash) return 2;
  const named = [...new Set(files)];
  if (setup.said) say(`red-before: ${setup.said}`);
  const plan = { hash, copied: named, install: setup.commands.install, installFrom: setup.installFrom };
  return inCommitTree({ root: setup.root, label: "red-before", plan }, say, async (scratch) => {
    say(`red-before: ${hash.slice(0, 12)}'s code, ${plural(named.length, "test file")}`);
    const cases = await treeCases({ ...setup, tree: scratch.tree, files: named, results: scratch.results, label: "red-before" }, say);
    for (const line of listedByFile(cases)) say(line);
    say(`red-before: ${counted(cases)}`);
    return 0;
  });
}
