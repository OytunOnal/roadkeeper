// @level application
// Roadkeeper — same-cases: whether a change kept every case's outcome. The base is the commit's whole tree, laid out in a
// throwaway folder of the OS temp folder with the install linked in and the siblings today's package.json names beside
// it (commit-tree.mjs), carrying nothing from today; today is the working tree in place. On each, only the named test
// files it holds, those the commands file's `tests` pattern, else the adapter's, matches, a named file it does not match
// said once as not run; or with none named every file the pattern matches there; run by name after `beforeTests`
// (test-run.mjs): the base first, then today. A base suite with a suite record standing for it is read
// from it in place of running, said (recorded-base.mjs), unless FRESH is given; each suite run on either tree writes its
// suite record for that tree, the base's commit tree or today's tested tree (suite-records.mjs, tested-tree.mjs).
// Prints "same outcomes" with the counts, or each case whose outcomes differ with both, an unknown one on either tree
// always, and under it why on each tree (case-outcomes.mjs), in the words handed in (case-outcome-lines.mjs). Git, the
// commit tree, the test run and the suite records are reached only through the adapters the entry hands in.
//
// Exits 0 when every case kept its outcome; 1 when one did not, or no file or case was found on either tree; 2 when the commands
// file refuses or no tree could be built; 3 when a named file is a test file of neither tree, or no named file is a test
// file.

import { plural } from "../../_text.mjs";
import { changedCases } from "./case-outcomes.mjs";
import { splitRecordedBase } from "./recorded-base.mjs";
import { shownName } from "./shown-name.mjs";

const BASE_LABEL = "base"; // the base's lines start with it
const TODAY_LABEL = "working tree"; // today's lines start with it
const FRESH = "--fresh"; // the option running every base suite, its suite records read by none

// The test files each tree runs: { base, today, notTests, fault }, `notTests` the named files the pattern does not
// match, `fault` the fault's lines when no named file is a test file, else null (namedFilesSplit); or { missing }, a
// named test file neither holds. `run`: testSetup's, with { hash, adapters }.
function sideFiles(run, names) {
  const { root, hash, isTest, adapters } = run;
  const { commitFiles, workingFiles, namedFilesSplit, fileName, workingFile } = adapters;
  const atBase = commitFiles(root, hash);
  if (!names.length) return { base: atBase.filter(isTest), today: workingFiles(root).filter(isTest), notTests: [], fault: null };
  const { tests, notTests, fault } = namedFilesSplit(run, [...new Set(names.map(fileName))], "same-cases");
  const held = new Set(atBase);
  const base = tests.filter((f) => held.has(f));
  const today = tests.map((f) => workingFile(root, f)).filter(Boolean);
  const missing = tests.find((f) => !held.has(f) && !today.includes(f));
  return missing === undefined ? { base, today, notTests, fault } : { missing };
}

// The lines comparing the base's cases with today's, in `words` (testSetup's), each handed to `say`: the exit code.
function compared({ base, today, words }, say) {
  if (!base.length && !today.length) { say("same-cases: no case read on either tree"); return 1; }
  const changed = changedCases(base, today);
  if (!changed.length) { say(`same outcomes: ${words.counted(today)}`); return 0; }
  for (const line of changed.flatMap(words.differenceLines)) say(line);
  say(`same-cases: ${plural(changed.length, "case")} ${changed.length === 1 ? "differs" : "differ"}`);
  return 1;
}

// Same-cases of the worktree holding `dir`, against the commit `args` names first, over the test files it names next or
// every one, FRESH anywhere among them, each line handed to `say`: a promise of the exit code. `call`: { dir, args,
// matches, recordedEdges, words, adapters }, `matches(pattern, path)` the test-file pattern's reading,
// `recordedEdges(root)` the edges a tree's structure.json records ({ recorded, edges }), `words` the lines the runs say
// (testSetup's), the cases' among them, `adapters` the git, commit tree, test run and suite records calls the entry
// hands in.
export async function sameCases(call, say) {
  const { adapters } = call;
  const fresh = call.args.includes(FRESH);
  const [commit, ...names] = call.args.filter((a) => a !== FRESH);
  const setup = { ...adapters.testSetup(call), adapters };
  if (setup.refused) { say(`same-cases: ${setup.refused}`); return 2; }
  const { root, installFrom, commands } = setup;
  const hash = adapters.namedCommit({ root, name: commit, label: "same-cases" }, say);
  if (!hash) return 2;
  const files = sideFiles({ ...setup, hash }, names);
  if (files.missing) { say(`same-cases: ${shownName(files.missing)} is a test file of neither tree`); return 3; }
  if (files.fault) { for (const line of files.fault) say(line); return 3; }
  for (const f of files.notTests) say(`same-cases: ${shownName(f)} not run: not a test file`);
  const none = !files.base.length && !files.today.length;
  if (none) { say(`same-cases: no file matches ${shownName(setup.patternsLine)} on either tree`); return 1; }
  if (setup.said) say(`same-cases: ${setup.said}`);
  const plan = { hash, copied: [], install: commands.install, installFrom };
  const trees = { main: adapters.checkouts(root).main, hash, base: adapters.treeOf(root, hash) };
  return adapters.inCommitTree({ root, label: "same-cases", plan }, say, async (scratch) => {
    const base = await readOrRunBaseRecording({ ...setup, recordedEdges: call.recordedEdges, trees, scratch, suites: files.base, fresh }, say);
    const today = await runTodayRecording({ ...setup, trees, scratch, suites: files.today }, say);
    return compared({ base, today, words: setup.words }, say);
  });
}

// Today's cases: its suites run in the working tree, their suite records written for the tested tree taken before the
// run, none when the run changed it (said). `run`: testSetup's, with { adapters, trees, scratch, suites }. A promise of
// the cases.
async function runTodayRecording(run, say) {
  const { root, commands, trees, scratch, suites, adapters } = run;
  const { testedTree, treeCases, pathJoin, writeSuiteRecords, formatUnwrittenLine } = adapters;
  const tree = testedTree(root, commands.install);
  const today = await treeCases({ ...run, tree: root, files: suites, results: pathJoin(scratch.results, "today"), label: TODAY_LABEL }, say);
  if (tree !== testedTree(root, commands.install)) { say(`${TODAY_LABEL}: no suite record written: the tree changed during the run`); return today; }
  const unwritten = writeSuiteRecords(trees.main, tree, { cases: today, suites });
  if (unwritten) say(formatUnwrittenLine(unwritten, TODAY_LABEL));
  return today;
}

// The base as recorded-base.mjs reads it, from readOrRunBaseRecording's `run`: the base's test files, the suites named
// among them whatever the pattern says, its declared run lists, and the edges its structure.json records, read in its
// laid-out tree.
function describeBaseForRecords({ root, isTest, isRunList, recordedEdges, adapters, trees, scratch, suites }) {
  const { recorded, edges } = recordedEdges(scratch.tree);
  const files = adapters.commitFiles(root, trees.hash);
  const tests = [...new Set([...files.filter(isTest), ...suites])];
  const runLists = isRunList ? files.filter(isRunList) : [];
  const reach = { tree: scratch.tree, edges: recorded ? edges : null, runLists };
  return { root, main: trees.main, tree: trees.base, tests, suites, reach, adapters };
}

// The base's cases: each suite's read from its suite record where it may be (recorded-base.mjs), the rest run on the
// commit's tree and their suite records written. `run`: testSetup's, with { recordedEdges, adapters, trees, scratch,
// suites, fresh }, `trees` { main, hash, base }, the main checkout, the base's commit and its tree; `fresh`, every suite
// run, no record read. A promise of the cases.
async function readOrRunBaseRecording(run, say) {
  const { trees, scratch, suites, fresh } = run;
  const { treeCases, pathJoin, writeSuiteRecords, formatUnwrittenLine } = run.adapters;
  const split = fresh ? { read: [], run: suites, lines: [] } : splitRecordedBase(describeBaseForRecords(run), BASE_LABEL);
  for (const line of split.lines) say(line);
  if (!split.run.length) return split.read;
  const ran = await treeCases({ ...run, tree: scratch.tree, files: split.run, results: pathJoin(scratch.results, "base"), label: BASE_LABEL }, say);
  const unwritten = writeSuiteRecords(trees.main, trees.base, { cases: ran, suites: split.run });
  if (unwritten) say(formatUnwrittenLine(unwritten, BASE_LABEL));
  return [...split.read, ...ran];
}
