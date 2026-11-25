// @level infrastructure
// Roadkeeper — a project's tests run by name in one tree: `beforeTests`' steps first (steps-run.mjs), then `runTests` over
// the test files, as many to a run as the commands file's `filesPerRun`, the runs side by side, each bounded by its
// files (command-run.mjs, testRunLimit), each run's cases read by
// the adapter, a crashed file's then made unknown (case-outcomes.mjs); a crashed run's other files each run again alone,
// to find a crash the run did not write. `{files}`, an argument of its own, becomes the run's files, each its own
// argument; `{out}`, anywhere in an argument, a results file in the caller's folder. A run no case is read from is
// said, with why and its last lines. The green's `{tests}` step runs every test file of the worktree so, in place, and
// says only the failed cases, a total line and its slowest test files with their seconds: a run of one file's own, else
// its cases' times summed from the results; the green's doc tests run the same way, alone. The test sweep runs one
// test file at a time, whole by `runTests` or by `runCases` with only the cases it keeps: there an argument holding
// `{case}` is repeated once per kept case, `{case}` its id.

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { pathFrom } from "../../_files.mjs";
import { SLOWEST_MAX, TESTS_LABEL } from "../../_slowest-lines.mjs";
import { plural } from "../../_text.mjs";
import { adapterOf } from "../adapters/adapters.mjs";
import { crashedFiles, unknownMarked } from "./case-outcomes.mjs";
import { commandEnv, runCommandWithin, testRunLimit } from "./command-run.mjs";
import { COMMANDS_FILE } from "./commands-fields.mjs";
import { readCommands } from "./commands-file.mjs";
import { workingFile, workingFiles } from "./commit-tree.mjs";
import { shownName } from "./shown-name.mjs";
import { tailLines } from "./tail-lines.mjs";
import { firstRedStep } from "./steps-run.mjs";
import { worktreeInstall, worktreeRoot } from "./worktree.mjs";

const FILES = "{files}"; // runTests' argument the test files take the place of
const OUT = "{out}";     // runTests' text a results file's path takes the place of
const CASE = "{case}";   // runCases' text a kept case's id takes the place of, its argument repeated for each
const WORKERS = availableParallelism(); // runs side by side: one per processor
const WILDCARD = /[*?[{]/; // a pattern part holding one names no fixed folder
const INSTALLED = new Set(["node_modules", "site-packages", "dist-packages"]); // a folder of installed packages: no project code
const NOT_FAILED = new Set(["PASS", "SKIP"]); // the outcomes the `{tests}` step does not list: a skipped case is no failure

// The test files' patterns of a project's `commands` (the commands file's, read): its `tests`, else its stack adapter's.
const testPatterns =(commands) => (commands.tests ? [commands.tests] : adapterOf(commands.stack).tests);

// Whether a path, from the root, is one of a project's test files: `testFileMatcher(commands, matches)(path)`, `matches`
// reading it against each of its test files' patterns (testPatterns).
export function testFileMatcher(commands, matches) {
  const patterns = testPatterns(commands);
  return (path) => patterns.some((pattern) => matches(pattern, path));
}

// The project's tests at the worktree holding `dir`, ready to run by name, its install linked in when it is a linked
// worktree with none (worktree.mjs): { root, installFrom, said, commands, adapter, patternsLine, isTest, isRunList,
// words }, `installFrom` the checkout whose install a tree laid out for it links (null: none), `said` the line saying
// why none is linked or null, `patternsLine` the test files' patterns (testPatterns) as a line says them, `isTest(path)`
// whether `matches` reads the path as matching one of them, `isRunList(path)` whether one of the commands file's
// `runLists` patterns names it (null when it declares none), `words` the lines the runs say, as the entry hands them
// in: { counted, listedByFile, differenceLines }, the cases' (case-outcome-lines.mjs), { passLine, failLines }, the
// steps' (step-lines.mjs), { totalLine, slowestLines }, the `{tests}` step's (test-run-lines.mjs); or { refused }, the
// line saying why not.
export function testSetup({ dir, matches, words }) {
  const root = worktreeRoot(dir);
  if (!root) return { refused: "not in a git repository" };
  const { commands, refused } = readCommands(root);
  if (refused) return { refused };
  if (!commands.runTests) return { refused: `${COMMANDS_FILE} has no \`runTests\`` };
  if (!commands.runTests.includes(FILES)) return { refused: `${COMMANDS_FILE}'s \`runTests\` has no ${FILES} argument` };
  const adapter = adapterOf(commands.stack);
  const { from, said } = worktreeInstall(root, commands.install);
  const [patternsLine, isTest] = [testPatterns(commands).join(" or "), testFileMatcher(commands, matches)];
  const runLists = commands.runLists ?? [];
  const isRunList = runLists.length ? (path) => runLists.some((pattern) => matches(pattern, path)) : null;
  return { root, installFrom: from, said: said ?? null, commands, adapter, patternsLine, isTest, isRunList, words };
}

// The named files `named`, by their paths from the root, split by the test files' pattern of `setup` (testSetup's):
// { tests, notTests, fault }, `fault` the fault's lines, its step first, each starting with `label`, when no named file
// is a test file; else null. Each name and the pattern as a line shows them (shownName).
export function namedFilesSplit(setup, named, label) {
  const tests = named.filter(setup.isTest);
  const notTests = named.filter((f) => !setup.isTest(f));
  const fault = tests.length ? null : [
    `${label}: name a test file beside them, one matching ${shownName(setup.patternsLine)}; no suite ran`,
    `${label}: not test files: ${notTests.map(shownName).join(", ")}`];
  return { tests, notTests, fault };
}

// The run lists of the worktree `setup` holds (testSetup's): the files of its root `isRunList` names; none listed when
// the commands file declares none.
export const worktreeRunLists = ({ root, isRunList }) => (isRunList ? workingFiles(root).filter(isRunList) : []);

const expanded = (argv, files, out) => argv.flatMap((a) => (a === FILES ? files : [a.replaceAll(OUT, out)]));

// The files in groups of `size` at most, in their order.
function groups(files, size) {
  const all = [];
  for (let k = 0; k < files.length; k += size) all.push(files.slice(k, k + size));
  return all;
}

// A pool every caller of it shares: `pool(tasks)` runs each task, WORKERS at a time across all the tasks any caller has
// handed it, in the order they were handed in; a promise of their results, in the tasks' order.
export function makeSharedPool() {
  let freeSlots = WORKERS;
  const waiting = [];
  const takeSlot = () => (freeSlots > 0 ? (freeSlots--, Promise.resolve()) : new Promise((resolve) => waiting.push(resolve)));
  const release = () => { const next = waiting.shift(); if (next) next(); else freeSlots++; };
  return (tasks) => Promise.all(tasks.map(async (task) => {
    await takeSlot();
    try { return await task(); } finally { release(); }
  }));
}

// Each task run, WORKERS at a time: a promise of their results, in the tasks' order.
export const inPool = (tasks) => makeSharedPool()(tasks);

// One run of runTests over these files, its results file at `out`: a promise of { ran, cases }. `run`: { tree,
// commands, adapter, env }.
async function runCases(run, files, out) {
  const { tree, commands, adapter, env } = run;
  const ran = await runCommandWithin(expanded(commands.runTests, files, out), { cwd: tree, env, timeout: testRunLimit(files.length) });
  return { ran, cases: adapter.cases({ root: tree, files, output: ran.tail, results: out }) };
}

// The crashed files of a run over the group, `crashOf` (crashedFiles'), with those found alone: when the run crashed,
// each other file it read a case from runs again alone, and is crashed by its own crash when that run crashes, since
// Vitest, given two crashing files, may write only one's crash. A promise of the map.
async function crashesFoundAlone(run, cases, crashOf) {
  const found = new Map(crashOf);
  if (!crashOf.size) return found;
  const others = run.group.filter((f) => !crashOf.has(f) && cases.some((c) => c.file === f));
  for (const [k, file] of others.entries()) {
    const alone = await runCases(run, [file], `${run.out}-alone-${k + 1}`);
    const own = crashedFiles(alone.cases, [file]).get(file);
    if (own !== undefined) found.set(file, own);
  }
  return found;
}

// One run of runTests over a group of files: a promise of { group, ran, cases }, each case of a crashed file unknown.
// `run`: { tree, commands, adapter, env, group, out }.
async function groupCases(run) {
  const { ran, cases } = await runCases(run, run.group, run.out);
  const crashOf = await crashesFoundAlone(run, cases, crashedFiles(cases, run.group));
  return { group: run.group, ran, cases: unknownMarked(cases, crashOf) };
}

// The lines saying a run read no case: how many files it ran, how it ended and its last lines.
const emptyRunLines = ({ group, ran }, label) => [
  `${label}: no case read from the run of ${plural(group.length, "test file")}: ${ran.why || "exit 0"}`, ...tailLines(ran.tail)];

// `beforeTests`' steps run at the root of a tree, each line handed to `say`, one of its own starting with `label`: a
// promise. `run`: { tree, commands, words, label }.
export const runTreeBeforeTests = ({ tree, commands, words, label }, say) =>
  runBeforeTests({ root: tree, commands, words }, (l) => say(l.startsWith(" ") ? l : `${label}: ${l}`));

// The runs of the test files in a tree, each { group, ran, cases }: a promise of them, a run that read no case said.
// `run` and `say` as treeCases' are.
async function treeRuns(run, say) {
  const { tree, commands, adapter, files, results, label, pool = inPool } = run;
  if (!run.beforeTestsRan) await runTreeBeforeTests(run, say);
  mkdirSync(results, { recursive: true });
  const env = commandEnv(tree);
  const tasks = groups(files, commands.filesPerRun).map((group, k) => () => groupCases(
    { tree, commands, adapter, env, group, out: join(results, `results-${k + 1}`) }));
  const read = await pool(tasks);
  for (const r of read) if (!r.cases.length) for (const line of emptyRunLines(r, label)) say(line);
  return read;
}

// `beforeTests`' steps run at the root of the worktree `setup` holds (testSetup's), each line handed to `say`: a promise.
export async function runBeforeTests({ root, commands, words }, say) {
  const before = commands.beforeTests ?? [];
  if (before.length) await firstRedStep({ root, steps: before, words }, (l) => say(l.startsWith(" ") ? l : `beforeTests: ${l}`));
}

// runCases' arguments for one test file: `{files}` the file, `{out}` the results file, an argument holding `{case}`
// once per id kept.
const expandedForCases = (argv, { file, keep, out }) => argv.flatMap((argument) => {
  if (argument === FILES) return [file];
  const outFilled = argument.replaceAll(OUT, out);
  return outFilled.includes(CASE) ? keep.map((id) => outFilled.replaceAll(CASE, id)) : [outFilled];
});

// The folder a test files' pattern holds its files in, the parts before the first holding a wildcard, ending in "/";
// "" for a pattern starting with one (`**/*.test.ts`), which names no folder.
function patternFolder(pattern) {
  const fixed = [];
  for (const part of pattern.split("/").slice(0, -1)) {
    if (WILDCARD.test(part)) break;
    fixed.push(part);
  }
  return fixed.length ? `${fixed.join("/")}/` : "";
}

// Whether an absolute path is the project's code of the worktree `setup` holds (testSetup's), the question the test
// sweep's coverage asks: `projectCodeFile(setup)(file)`, its path from the root, else null. A file outside the root,
// in the install or a folder of installed packages, under .run/, matching a test file's pattern or in the folder a
// pattern holds its test files in (a test helper) is none.
export const projectCodeFile = ({ root, commands, isTest }) => {
  const testFolders = testPatterns(commands).map(patternFolder).filter(Boolean);
  const isInstalled = (path) => path.startsWith(`${commands.install}/`) || path.split("/").some((part) => INSTALLED.has(part));
  const isTestSide = (path) => isTest(path) || testFolders.some((folder) => path.startsWith(folder));
  return (file) => {
    const path = pathFrom(root, file);
    if (!path || path.startsWith(".run/")) return null;
    return isInstalled(path) || isTestSide(path) ? null : path;
  };
};

// One run of `argv` over the test file at the root of the worktree `setup` holds, under its environment with
// `addedEnv`'s variables over it, its results file at `out`: a promise of { ran, cases }.
async function runFile({ root, adapter }, argv, { file, addedEnv, out }) {
  const env = Object.assign(commandEnv(root), addedEnv);
  const ran = await runCommandWithin(argv, { cwd: root, env, timeout: testRunLimit(1) });
  return { ran, cases: adapter.cases({ root, files: [file], output: ran.tail, results: out }) };
}

// The test file `run.file` run whole by runTests (runFile): `run` { file, addedEnv, out }.
export const runFileWhole = (setup, run) => runFile(setup, expanded(setup.commands.runTests, [run.file], run.out), run);

// The test file `run.file` run by runCases with only the cases `run.keep` names, ids as the adapter reads them
// (runFile): `run` { file, keep, addedEnv, out }.
export const runFileKeeping = (setup, run) => runFile(setup, expandedForCases(setup.commands.runCases, run), run);

// The cases of the test files run in a tree, in the files' order: a promise of them, each line said handed to `say`,
// a line of its own starting with `label`. `run`: { tree, commands, adapter, files, results, label, pool,
// beforeTestsRan }, `results` a folder for the results files, `pool` a makeSharedPool pool the runs take their turns in
// (none: one of their own), `beforeTestsRan` true when the caller already ran the tree's `beforeTests`
// (runTreeBeforeTests), else they run first.
export const treeCases = async (run, say) => (await treeRuns(run, say)).flatMap((r) => r.cases);

// The test files of the worktree `setup` holds (testSetup's) that its patterns match, each a plain file inside the root
// with no link on the way: a file reached through a linked folder is not among them.
export const worktreeTests = ({ root, isTest }) =>
  workingFiles(root).filter(isTest).map((f) => workingFile(root, f)).filter(Boolean);

// The test files of a run of several, each { file, seconds, summed: true }, its seconds its cases' times summed; a file
// none of whose cases has a time is left out.
function sumCaseSeconds(run) {
  const seconds = new Map();
  const timed = run.cases.filter((c) => Number.isFinite(c.time) && run.group.includes(c.file));
  for (const c of timed) seconds.set(c.file, (seconds.get(c.file) ?? 0) + c.time);
  return [...seconds].map(([file, sum]) => ({ file, seconds: sum, summed: true }));
}

// Each test file's seconds by the runs that ran it, each { file, seconds, summed }: a run of one file gives it the run's
// own, a run of several each file its cases' times summed (sumCaseSeconds).
const collectFileSeconds = (runs) => runs.flatMap((r) =>
  (r.group.length === 1 ? [{ file: r.group[0], seconds: r.ran.seconds, summed: false }] : sumCaseSeconds(r)));

// The SLOWEST_MAX test files of the runs, slowest first, each with its seconds: { timed, slowest, untimed }, `timed`
// every file timed (collectFileSeconds'), `untimed` how many files no time was read for.
function findSlowest(runs) {
  const timed = collectFileSeconds(runs);
  const untimed = runs.reduce((n, r) => n + r.group.length, 0) - timed.length;
  const slowest = timed.sort((a, b) => b.seconds - a.seconds).slice(0, SLOWEST_MAX);
  return { timed, slowest, untimed };
}

// The test files a run failed, in the files' order: each holding a failed or unknown case, and each of a run that read
// no case.
const failedFiles = (files, runs, failed) => {
  const named = new Set([...failed.map((c) => c.file), ...runs.filter((r) => !r.cases.length).flatMap((r) => r.group)]);
  return files.filter((f) => named.has(f));
};

// The green's `{tests}` step in the worktree `setup` holds (testSetup's): `files`, by their paths from its root, else
// every test file of it (worktreeTests), run by name in place, its results in a throwaway folder of the OS temp folder,
// removed after. Says each failed or unknown case with its detail under its file, then the total line, then the slowest
// test files (findSlowest), in `setup.words`; a run that read no case is said. A promise of { passes, failed, cases, files }: whether every case passed or was skipped, every run
// reading one, the test files that failed (failedFiles), every case read and the test files run.
export async function testsStepRun(setup, say, files = worktreeTests(setup)) {
  const started = Date.now();
  if (!files.length) say(`${TESTS_LABEL}: no file matches ${setup.patternsLine}`);
  const results = mkdtempSync(join(tmpdir(), "roadkeeper-green-tests-"));
  try {
    const runs = await treeRuns({ ...setup, tree: setup.root, files, results, label: TESTS_LABEL }, say);
    const cases = runs.flatMap((r) => r.cases);
    const failed = cases.filter((c) => !NOT_FAILED.has(c.outcome));
    for (const line of setup.words.listedByFile(failed)) say(line);
    const passes = cases.length > 0 && !failed.length && runs.every((r) => r.cases.length);
    say(setup.words.totalLine({ cases, files, passes, seconds: (Date.now() - started) / 1000 }));
    for (const line of setup.words.slowestLines(findSlowest(runs))) say(line);
    return { passes, failed: failedFiles(files, runs, failed), cases, files };
  } finally {
    rmSync(results, { recursive: true, force: true });
  }
}
