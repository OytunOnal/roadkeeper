// @level infrastructure
// Roadkeeper — a project's tests run by name in one tree: `beforeTests`' steps first (steps-run.mjs), then `runTests` over
// the test files, as many to a run as the commands file's `filesPerRun`, the runs side by side, each run's cases read by
// the adapter, a crashed file's then made unknown (case-outcomes.mjs); a crashed run's other files each run again alone,
// to find a crash the run did not write. `{files}`, an argument of its own, becomes the run's files, each its own
// argument; `{out}`, anywhere in an argument, a results file in the caller's folder. A run no case is read from is
// said, with why and its last lines.

import { mkdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { plural } from "../../_text.mjs";
import { adapterOf } from "../adapters/adapters.mjs";
import { crashedFiles, unknownMarked } from "./case-outcomes.mjs";
import { commandEnv, runCommandForOutput } from "./command-run.mjs";
import { COMMANDS_FILE, readCommands } from "./commands-file.mjs";
import { stepsPass, tailLines } from "./steps-run.mjs";
import { worktreeInstall, worktreeRoot } from "./worktree.mjs";

const FILES = "{files}"; // runTests' argument the test files take the place of
const OUT = "{out}";     // runTests' text a results file's path takes the place of
const WORKERS = availableParallelism(); // runs side by side: one per processor

// The project's tests at the worktree holding `dir`, ready to run by name, its install linked in when it is a linked
// worktree with none (worktree.mjs): { root, installFrom, said, commands, adapter, patternsLine, isTest }, `installFrom`
// the checkout whose install a tree laid out for it links (null: none), `said` the line saying why none is linked or
// null, `patternsLine` the test files' patterns as a line says them, the commands file's one else the adapter's, `isTest(path)`
// whether `matches` reads the path as matching one of them; or { refused }, the line saying why not.
export function testSetup({ dir, matches }) {
  const root = worktreeRoot(dir);
  if (!root) return { refused: "not in a git repository" };
  const { commands, refused } = readCommands(root);
  if (refused) return { refused };
  if (!commands.runTests) return { refused: `${COMMANDS_FILE} has no \`runTests\`` };
  if (!commands.runTests.includes(FILES)) return { refused: `${COMMANDS_FILE}'s \`runTests\` has no ${FILES} argument` };
  const adapter = adapterOf(commands.stack);
  const { from, said } = worktreeInstall(root, commands.install);
  const patterns = commands.tests ? [commands.tests] : adapter.tests;
  const isTest = (path) => patterns.some((pattern) => matches(pattern, path));
  return { root, installFrom: from, said: said ?? null, commands, adapter, patternsLine: patterns.join(" or "), isTest };
}

const expanded = (argv, files, out) => argv.flatMap((a) => (a === FILES ? files : [a.replaceAll(OUT, out)]));

// The files in groups of `size` at most, in their order.
function groups(files, size) {
  const all = [];
  for (let k = 0; k < files.length; k += size) all.push(files.slice(k, k + size));
  return all;
}

// Each task run, WORKERS at a time: a promise of their results, in the tasks' order.
async function inPool(tasks) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => { while (next < tasks.length) { const k = next++; results[k] = await tasks[k](); } };
  await Promise.all(Array.from({ length: Math.min(WORKERS, tasks.length) }, worker));
  return results;
}

// One run of runTests over these files, its results file at `out`: a promise of { ran, cases }. `run`: { tree,
// commands, adapter, env }.
async function runCases(run, files, out) {
  const { tree, commands, adapter, env } = run;
  const ran = await runCommandForOutput(expanded(commands.runTests, files, out), tree, env);
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

// The cases of the test files run in a tree, in the files' order: a promise of them, each line said handed to `say`,
// a line of its own starting with `label`. `run`: { tree, commands, adapter, files, results, label }, `results` a
// folder for the results files.
export async function treeCases(run, say) {
  const { tree, commands, adapter, files, results, label } = run;
  const before = commands.beforeTests ?? [];
  if (before.length) await stepsPass(tree, before, (l) => say(l.startsWith(" ") ? l : `${label}: beforeTests: ${l}`));
  mkdirSync(results, { recursive: true });
  const env = commandEnv(tree);
  const tasks = groups(files, commands.filesPerRun).map((group, k) => () => groupCases(
    { tree, commands, adapter, env, group, out: join(results, `results-${k + 1}`) }));
  const read = await inPool(tasks);
  for (const r of read) if (!r.cases.length) for (const line of emptyRunLines(r, label)) say(line);
  return read.flatMap((r) => r.cases);
}
