// @level infrastructure
// Roadkeeper — same-cases: whether a change kept every case's outcome. The base is the commit's whole tree, laid out in a
// throwaway folder of the OS temp folder with the install linked in and the siblings today's package.json names beside
// it (commit-tree.mjs); today is the working tree in place. On each, the named test files it holds, or with none
// named every file the commands file's `tests` pattern, else the adapter's, matches there, run by name after
// `beforeTests` (test-run.mjs): the base first, then today. Prints "same outcomes" with the counts, or each case whose
// outcomes differ with both (case-outcomes.mjs).
//
// Exits 0 when every case kept its outcome; 1 when one did not, or no file or case was found on either tree; 2 when the commands
// file refuses or no tree could be built; 3 when a named file is a test file of neither tree.

import { join } from "node:path";
import { plural } from "../../_text.mjs";
import { counted, differences } from "./case-outcomes.mjs";
import { commitFiles, fileName, inCommitTree, namedCommit, shownName, workingFile, workingFiles } from "./commit-tree.mjs";
import { testSetup, treeCases } from "./test-run.mjs";

// The test files each tree runs: { base, today }, or { missing }, a named file neither holds. `run`: { root, hash,
// isTest }.
function sideFiles(run, names) {
  const { root, hash, isTest } = run;
  const atBase = commitFiles(root, hash);
  if (!names.length) return { base: atBase.filter(isTest), today: workingFiles(root).filter(isTest) };
  const named = [...new Set(names.map(fileName))];
  const held = new Set(atBase);
  const base = named.filter((f) => held.has(f));
  const today = named.map((f) => workingFile(root, f)).filter(Boolean);
  const missing = named.find((f) => !held.has(f) && !today.includes(f));
  return missing === undefined ? { base, today } : { missing };
}

// The lines comparing the base's cases with today's, each handed to `say`: the exit code.
function compared(base, today, say) {
  if (!base.length && !today.length) { say("same-cases: no case read on either tree"); return 1; }
  const lines = differences(base, today);
  if (!lines.length) { say(`same outcomes: ${counted(today)}`); return 0; }
  for (const line of lines) say(line);
  say(`same-cases: ${plural(lines.length, "case")} ${lines.length === 1 ? "differs" : "differ"}`);
  return 1;
}

// Same-cases of the worktree holding `dir`, against the commit `args` names first, over the test files it names next or
// every one, each line handed to `say`: a promise of the exit code. `call`: { dir, args, matches }, `matches(pattern,
// path)` the test-file pattern's reading.
export async function sameCases(call, say) {
  const [commit, ...names] = call.args;
  const setup = testSetup(call);
  if (setup.refused) { say(`same-cases: ${setup.refused}`); return 2; }
  const { root, installFrom, commands } = setup;
  const hash = namedCommit({ root, name: commit, label: "same-cases" }, say);
  if (!hash) return 2;
  const files = sideFiles({ ...setup, hash }, names);
  if (files.missing) { say(`same-cases: ${shownName(files.missing)} is a test file of neither tree`); return 3; }
  const none = !files.base.length && !files.today.length;
  if (none) { say(`same-cases: no file matches ${shownName(setup.patternsLine)} on either tree`); return 1; }
  if (setup.said) say(`same-cases: ${setup.said}`);
  const plan = { hash, copied: [], install: commands.install, installFrom };
  return inCommitTree({ root, label: "same-cases", plan }, say, async (scratch) => {
    const base = await treeCases({ ...setup, tree: scratch.tree, files: files.base, results: join(scratch.results, "base"), label: "base" }, say);
    const today = await treeCases({ ...setup, tree: root, files: files.today, results: join(scratch.results, "today"), label: "working tree" }, say);
    return compared(base, today, say);
  });
}
