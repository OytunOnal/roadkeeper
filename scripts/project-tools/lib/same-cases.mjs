// @level infrastructure
// Roadkeeper — same-cases: whether a change kept every case's outcome. The base is the commit's whole tree, laid out in a
// throwaway folder of the OS temp folder with the install linked in and the siblings today's package.json names beside
// it (commit-tree.mjs); today is the working tree in place. On each, the named test files it holds, or with none
// named every file the commands file's `tests` pattern, else the adapter's, matches there, run by name after
// `beforeTests` (test-run.mjs): the base first, then today. A base suite with a suite record standing for it is read
// from it in place of running, said (recorded-base.mjs), unless FRESH is given; each suite run on either tree writes its
// suite record for that tree, the base's commit tree or today's tested tree (suite-records.mjs, tested-tree.mjs).
// Prints "same outcomes" with the counts, or each case whose outcomes differ with both, an unknown one on either tree
// always, and under it why on each tree (case-outcomes.mjs).
//
// Exits 0 when every case kept its outcome; 1 when one did not, or no file or case was found on either tree; 2 when the commands
// file refuses or no tree could be built; 3 when a named file is a test file of neither tree.

import { join } from "node:path";
import { git } from "../../_git.mjs";
import { plural } from "../../_text.mjs";
import { counted, differences } from "./case-outcomes.mjs";
import { commitFiles, fileName, inCommitTree, namedCommit, shownName, workingFile, workingFiles } from "./commit-tree.mjs";
import { splitRecordedBase } from "./recorded-base.mjs";
import { formatUnwrittenLine, writeSuiteRecords } from "./suite-records.mjs";
import { testSetup, treeCases } from "./test-run.mjs";
import { testedTree } from "./tested-tree.mjs";
import { checkouts } from "./worktree.mjs";

const BASE_LABEL = "base"; // the base's lines start with it
const TODAY_LABEL = "working tree"; // today's lines start with it
const FRESH = "--fresh"; // the option running every base suite, its suite records read by none

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
  const changed = differences(base, today);
  if (!changed.length) { say(`same outcomes: ${counted(today)}`); return 0; }
  for (const line of changed.flat()) say(line);
  say(`same-cases: ${plural(changed.length, "case")} ${changed.length === 1 ? "differs" : "differ"}`);
  return 1;
}

// Same-cases of the worktree holding `dir`, against the commit `args` names first, over the test files it names next or
// every one, FRESH anywhere among them, each line handed to `say`: a promise of the exit code. `call`: { dir, args,
// matches, recordedEdges }, `matches(pattern, path)` the test-file pattern's reading, `recordedEdges(root)` the edges a
// tree's structure.json records ({ recorded, edges }).
export async function sameCases(call, say) {
  const fresh = call.args.includes(FRESH);
  const [commit, ...names] = call.args.filter((a) => a !== FRESH);
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
  const trees = { main: checkouts(root).main, hash, base: git(["rev-parse", `${hash}^{tree}`], root) };
  return inCommitTree({ root, label: "same-cases", plan }, say, async (scratch) => {
    const base = await readOrRunBaseRecording({ ...setup, recordedEdges: call.recordedEdges, trees, scratch, suites: files.base, fresh }, say);
    const today = await runTodayRecording({ ...setup, trees, scratch, suites: files.today }, say);
    return compared(base, today, say);
  });
}

// Today's cases: its suites run in the working tree, their suite records written for the tested tree taken before the
// run, none when the run changed it (said). `run`: testSetup's, with { trees, scratch, suites }. A promise of the cases.
async function runTodayRecording(run, say) {
  const { root, commands, trees, scratch, suites } = run;
  const tree = testedTree(root, commands.install);
  const today = await treeCases({ ...run, tree: root, files: suites, results: join(scratch.results, "today"), label: TODAY_LABEL }, say);
  if (tree !== testedTree(root, commands.install)) { say(`${TODAY_LABEL}: no suite record written: the tree changed during the run`); return today; }
  const unwritten = writeSuiteRecords(trees.main, tree, { cases: today, suites });
  if (unwritten) say(formatUnwrittenLine(unwritten, TODAY_LABEL));
  return today;
}

// The base as recorded-base.mjs reads it, from readOrRunBaseRecording's `run`: the base's test files, the suites named
// among them whatever the pattern says, its declared run lists, and the edges its structure.json records, read in its
// laid-out tree.
function describeBaseForRecords({ root, isTest, isRunList, recordedEdges, trees, scratch, suites }) {
  const { recorded, edges } = recordedEdges(scratch.tree);
  const files = commitFiles(root, trees.hash);
  const tests = [...new Set([...files.filter(isTest), ...suites])];
  const runLists = isRunList ? files.filter(isRunList) : [];
  const reach = { tree: scratch.tree, edges: recorded ? edges : null, runLists };
  return { root, main: trees.main, tree: trees.base, tests, suites, reach };
}

// The base's cases: each suite's read from its suite record where it may be (recorded-base.mjs), the rest run on the
// commit's tree and their suite records written. `run`: testSetup's, with { recordedEdges, trees, scratch, suites,
// fresh }, `trees` { main, hash, base }, the main checkout, the base's commit and its tree; `fresh`, every suite run, no
// record read. A promise of the cases.
async function readOrRunBaseRecording(run, say) {
  const { trees, scratch, suites, fresh } = run;
  const split = fresh ? { read: [], run: suites, lines: [] } : splitRecordedBase(describeBaseForRecords(run), BASE_LABEL);
  for (const line of split.lines) say(line);
  if (!split.run.length) return split.read;
  const ran = await treeCases({ ...run, tree: scratch.tree, files: split.run, results: join(scratch.results, "base"), label: BASE_LABEL }, say);
  const unwritten = writeSuiteRecords(trees.main, trees.base, { cases: ran, suites: split.run });
  if (unwritten) say(formatUnwrittenLine(unwritten, BASE_LABEL));
  return [...split.read, ...ran];
}
