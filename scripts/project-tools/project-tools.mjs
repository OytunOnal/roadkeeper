// @level main
// Roadkeeper — the project tools' entry, their one interface: a project's commands file, the green run from it, the
// project's copy of the plugin's lint rules, its tests run by name: red-before and same-cases, a change's reader tests,
// whether a commit may land, the check at write, a written file judged by the project's linter, and the borrowed
// install, the main checkout's linked into a linked worktree (borrow-install and the structure command). It wires the
// commands file's reader, the worktree and its install, the tested tree, the green stamp and the stamped tree near a
// tree, the green's inputs and doc tests, the steps run, the rules' copy, the tests' runs, the reader scan, the landing
// check and the written file's lint (lib/, infrastructure, private), the stack adapters (adapters/, the seam) and the
// structure module's report and file patterns.
//
// What the green reads, under the root of the worktree it is given: docs/roadkeeper/commands.json
// (lib/commands-file.mjs), the lint rules' copy, roadkeeper-lint/, against the plugin's scripts/lint/
// (lib/rules-copy.mjs), docs/roadkeeper/dependency-rules.md and what the structure check reads, and the tracker
// snapshot. It writes the install's link into a linked worktree that has none and pins what the main checkout pins
// (lib/worktree.mjs), and the green stamp and a red run's record in the main checkout's .run/; a rerun asks git for the
// change against the remote's default branch and reads its failed files' text (lib/green-rerun.mjs). The commands it
// runs are the project's own, run from the worktree's root, a `{tests}` step's over the test files git lists there,
// a rerun's over its red run's failed test files among them, and the doc tests' over the files
// the commands file names, none through a link, their results in a throwaway folder of the OS temp folder. A full green
// also reads those test files' text, each a plain file under the reader scan's cap, against the paths of the files
// `readByNothing` lists. The copy command writes roadkeeper-lint/ alone. Red-before, same-cases and reader-tests read
// and run what lib/red-before.mjs, lib/same-cases.mjs and lib/reader-tests.mjs say.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { todayLocal } from "../_clock.mjs";
import { shortHash } from "../_git.mjs";
import { recordsDir } from "../_files.mjs";
import { readTracker } from "../_tracker.mjs";
import { globMatch, recordedEdges, report } from "../structure/structure.mjs";
import { COMMANDS_FILE, namesDocTest, readCommands } from "./lib/commands-file.mjs";
import { docTestListsPass, docTestLists, docTestsRun, greenInputs } from "./lib/green-doc-tests.mjs";
import { rerunStampedLine, rerunnable } from "./lib/green-rerun.mjs";
import { now, redAtStep, redOnTests, redRun, stampedRecord, writeRedRun, writeStamp } from "./lib/green-stamp.mjs";
import { OWN_STAMP_ONLY, RUN_GREEN, landingRefusal as landingRefusalOf } from "./lib/landing.mjs";
import { nearStamp } from "./lib/near-stamp.mjs";
import { readerTests as readerTestsOf } from "./lib/reader-tests.mjs";
import { redBefore as redBeforeOf } from "./lib/red-before.mjs";
import { RULES_COPY, writeCopy } from "./lib/rules-copy.mjs";
import { sameCases as sameCasesOf } from "./lib/same-cases.mjs";
import { firstRedStep, isTestsStep, stepNamed } from "./lib/steps-run.mjs";
import { testsStepRun } from "./lib/test-run.mjs";
import { testedTree } from "./lib/tested-tree.mjs";
import { borrowInstall, checkouts, worktreeInstall, worktreeRoot } from "./lib/worktree.mjs";

// Red-before and same-cases of the worktree holding `dir`, `args` the command's arguments but --root, each line handed
// to `say`: a promise of the exit code. A test-file pattern reads as the structure module's file patterns do.
export const redBefore = (dir, args, say) => redBeforeOf({ dir, args, matches: globMatch }, say);
export const sameCases = (dir, args, say) => sameCasesOf({ dir, args, matches: globMatch }, say);

// reader-tests of the worktree holding `dir`, `args` the command's arguments but --root, each line handed to `say`: a
// promise of the exit code (lib/reader-tests.mjs); READER_TESTS_RUN, its option running the reader tests found. The
// edges it follows are the structure module's reading of structure.json.
export const readerTests = (dir, args, say) => readerTestsOf({ dir, args, matches: globMatch, recordedEdges }, say);
export { RUN as READER_TESTS_RUN } from "./lib/reader-tests.mjs";

// The remote-tracking ref of a remote's default branch in the worktree at `root`, `remoteHome(root, remote, home)`: ""
// when the remote's name can hold none or the clone holds none.
export { remoteHome } from "./lib/landing.mjs";

// The check at write's judgement of the file just written at `file`, an absolute path, by its project's `lintFile`,
// `writtenFileBreaches(file, project)`: only inside the session's project, the clone holding the folder `project`; a
// promise of { lines }, the refusal's lines, none when it passes or is not judged; { unread: true } when the linter's
// output could not be read; { said }, the line saying to install in a linked worktree (lib/written-file-lint.mjs).
export { writtenFileBreaches } from "./lib/written-file-lint.mjs";

// The plugin's lint rules copied into the project of the worktree holding `dir`, its RULES_COPY folder replaced whole,
// each line handed to `say`: its exit code, 0 copied, 2 refused with nothing written.
export function copyLintRules(dir, say) {
  const root = worktreeRoot(dir);
  if (!root) { say("copy-lint-rules: not in a git repository"); return 2; }
  if (!recordsDir(root)) { say("copy-lint-rules: docs/roadkeeper is missing or a link: not a Roadkeeper project"); return 2; }
  const { count, refused } = writeCopy(root);
  say(refused ? `copy-lint-rules: ${refused}` : `copy-lint-rules: ${count} files copied into ${RULES_COPY}/`);
  return refused ? 2 : 0;
}

// The borrowed install of the worktree holding `dir`, the commands file's `install` (lib/worktree.mjs), its line handed
// to `say`: its exit code, 0 with an install there to use, 1 with none, 2 refused with nothing done (no git repository,
// a commands file missing or malformed).
export function linkInstall(dir, say) {
  const root = worktreeRoot(dir);
  if (!root) { say("borrow-install: not in a git repository"); return 2; }
  const { commands, refused } = readCommands(root);
  if (refused) { say(`borrow-install: ${refused}`); return 2; }
  const { code, line } = borrowInstall(root, commands.install);
  say(`borrow-install: ${line}`);
  return code;
}

// The install folder `folder` of the worktree at `root`, the main checkout's linked in where it is a linked worktree
// with none and the two pin the same packages: { from, said }; and the root of the worktree holding a folder, null
// outside one (lib/worktree.mjs).
export { worktreeInstall, worktreeRoot } from "./lib/worktree.mjs";

// whether the project holds dependency rules: anything at their path, so a link there reads as the check's unread line
const holdsRules = (root) => { try { lstatSync(join(root, "docs", "roadkeeper", "dependency-rules.md")); return true; } catch { return false; } };

// The structure check's lines said, where the project holds dependency rules: whether it holds no hard, unread or stale
// line. A project without them passes, the check not run.
function structurePasses(root, say) {
  if (!holdsRules(root)) return true;
  const said = report(root, { snapshot: readTracker(root, true).snap, today: todayLocal(), stamping: null, snapshotOptional: true });
  for (const line of said.lines) say(line);
  return !said.failed;
}

// whether a `git -c` or GIT_CONFIG_* setting reaches this run: its green would hold only under that setting
const configOverridden = () => Object.keys(process.env).some((k) => k.toUpperCase().startsWith("GIT_CONFIG_"));

// The green stamp written for the tested tree, when the steps left it as they found it: the green's exit code. `run`:
// { root, main, tree, install }, the worktree, its main checkout, the tested tree and the install folder; `red`, when
// it went green on a rerun, the red run rerun (green-stamp.mjs's redRun), which the stamp and its line name.
function stamped(run, say, red) {
  const { root, main, tree, install } = run;
  if (tree && testedTree(root, install) !== tree) { say("green: red, the steps changed the tree"); return 1; }
  const written = tree && !configOverridden() && writeStamp(main, tree, red && { redDate: red.date, files: red.files });
  if (!written) say("green: green, no stamp written");
  else say(red ? rerunStampedLine(tree, red) : `green: stamped ${shortHash(tree)}`);
  return 0;
}

// The tree the green tests in the worktree at `root`, the install linked in first where it is a linked worktree with
// none (lib/worktree.mjs), the line saying why none is handed to `say`: { root, main, tree, install }, `main` its main
// checkout, whose .run/ holds the green stamp, `tree` the tested tree (lib/tested-tree.mjs).
function testedRun(root, install, say) {
  const { said } = worktreeInstall(root, install);
  if (said) say(`green: ${said}`);
  return { root, main: checkouts(root).main, tree: testedTree(root, install), install };
}

// Whether the green stamp holds the run's tree (testedRun's), said: such a tree runs nothing.
function ranGreen({ main, tree }, say) {
  const record = tree && stampedRecord(main, tree);
  if (record) say(`green: this tree (${shortHash(tree)}) ran green on ${record.date}; nothing run`);
  return Boolean(record);
}

// The commands file's steps from the `from`-th (0: every one), a `{tests}` step running the project's tests by `tests`,
// testSetup's (lib/test-run.mjs), then the structure check: a promise of null when all passed, else the red run to
// record (lib/green-stamp.mjs's redRun): the test files a `{tests}` step failed and the step after it, or the step that
// went red.
async function stepsRed({ root, commands, tests }, say, from = 0) {
  const steps = commands.green;
  const testsStep = tests && ((sayTests) => testsStepRun(tests, sayTests));
  const { at, tests: testsRun } = await firstRedStep({ root, steps, testsStep, from }, say);
  if (at < 0) return structurePasses(root, say) ? null : redAtStep("the structure check");
  const failed = isTestsStep(steps[at]) ? (testsRun?.failed ?? []) : [];
  return failed.length ? redOnTests(failed, at + 1) : redAtStep(stepNamed(steps, at));
}

// The red run of the doc tests' run (lib/green-doc-tests.mjs's docTestsRun): null when it passed; no step runs after.
const docTestsRed = ({ passes, failed }) => {
  if (passes) return null;
  return failed.length ? redOnTests(failed, null) : redAtStep("the doc tests");
};

// The red run written for the run's tested tree, a line saying `unwritten` when it could not be: red, exit 1.
function recordedRed(run, red, { say, unwritten }) {
  if (!run.tree || !writeRedRun(run.main, run.tree, red)) say(`green: ${unwritten}`);
  say("green: red");
  return 1;
}

// The green's end once its steps ran: `red` null, the run's tree stamped (stamped); else red, the red run recorded for
// the tree, keeping the mark of a rerun already run on it, so a tree reruns once.
function finished(run, red, say) {
  if (!red) return stamped(run, say);
  const rerun = run.tree ? redRun(run.main, run.tree)?.rerun : undefined;
  return recordedRed(run, { ...red, rerun }, { say, unwritten: "its red run could not be recorded; --rerun-failed will not find it" });
}

// The rerun of the tested tree's red run (lib/green-rerun.mjs): refused, exit 2, with nothing run; else its failed test
// files run alone, then the steps the red never reached and the structure check, the tree stamped when all pass (exit
// 0), else red (exit 1), the rerun recorded on the red run. `inputs`: greenInputs' { commands, tests }.
async function rerunGreen(run, inputs, say) {
  const { refusal, red } = rerunnable({ ...run, tests: inputs.tests, recordedEdges });
  if (refusal) { say(`green: ${refusal}`); return 2; }
  const ran = await testsStepRun(inputs.tests, say, red.files);
  const after = ran.passes && red.next !== null ? await stepsRed({ root: run.root, ...inputs }, say, red.next) : null;
  if (ran.passes && !after) return stamped(run, say, red);
  const rerun = ran.passes ? { date: now(), failed: after.files, step: after.step } : { date: now(), failed: ran.failed, step: null };
  return recordedRed(run, { ...red, rerun }, { say, unwritten: "its rerun could not be recorded on its red run" });
}

// The green of the worktree holding `dir`, each line handed to `say`: a promise of its exit code, 0 green, 1 red, 2
// refused with nothing run. A rules copy differing from the plugin's is red with nothing run, before the stamp is read,
// so a plugin's new rules reach a stamped tree; a tree the green stamp holds is green with nothing run; a `docTests` or
// `notDocTests` entry naming no file is red with nothing run; a tree differing from a stamped one only in files no step
// reads (lib/near-stamp.mjs) runs its doc tests alone; any other is first held to the doc-test lists, red there with
// nothing run, then runs every step, then the structure check (lib/green-doc-tests.mjs). A `["{tests}"]` step runs the
// project's test files by `runTests`, as red-before and same-cases do (lib/test-run.mjs); a commands file holding one,
// or `docTests`, that cannot run them is refused. A red run of the steps or the doc tests is recorded for the tree;
// `rerun`, the green reruns that record's failed test files instead (rerunGreen).
export async function green(dir, say, { rerun = false } = {}) {
  const root = worktreeRoot(dir);
  if (!root) { say("green: not in a git repository"); return 2; }
  const { code, commands, tests } = greenInputs({ root, matches: globMatch }, say);
  if (code !== undefined) return code;
  const run = testedRun(root, commands.install, say);
  if (ranGreen(run, say)) return 0;
  const lists = docTestLists(root, commands);
  if (lists.missing) { say(`green: red, ${lists.missing}`); return 1; }
  if (rerun) return rerunGreen(run, { commands, tests }, say);
  const near = run.tree && nearStamp({ root, main: run.main, matches: globMatch }, run.tree, commands.readByNothing);
  if (near) return finished(run, docTestsRed(await docTestsRun({ tests, files: lists.docTests, tree: run.tree, near }, say)), say);
  if (!docTestListsPass({ root, commands, named: lists.named, matches: globMatch }, say)) return 1;
  return finished(run, await stepsRed({ root, commands, tests }, say), say);
}

// What a landing on the default branch is held to in the project at the worktree root `root`: null when nothing, the
// root holding no Roadkeeper docs folder or no commands file; else { patterns }, the commands file's readByNothing,
// OWN_STAMP_ONLY (lib/landing.mjs) where it names a doc test, whose green runs them and stamps the tree; or
// { refusal }, the line saying why the commands file cannot be read and naming the green.
export function landingRules(root) {
  if (!recordsDir(root)) return null;
  try { lstatSync(join(root, ...COMMANDS_FILE.split("/"))); } catch (e) { if (e.code === "ENOENT") return null; }
  const { commands, refused } = readCommands(root);
  if (refused) return { refusal: `${refused}; fix it, then ${RUN_GREEN}` };
  return { patterns: namesDocTest(commands) ? OWN_STAMP_ONLY : commands.readByNothing };
}

// The refusal, in fixed words, the commit's hash and the green's command, of the first of `commits` (full hashes) that
// may not land from the worktree at `root`; null when each may: the remote's default branch, as its remote-tracking ref
// says, already holds it, its tree holds the green stamp, or it differs from a stamped tree only in files `patterns`
// names (OWN_STAMP_ONLY: none), the green's own inputs never among them. `landing`: { remote, home, commits,
// patterns }, the remote they land on and its default branch. A pattern reads as the structure module's file patterns
// do. Only reads: git and the green stamp.
export const landingRefusal = (root, landing) =>
  landingRefusalOf({ root, main: checkouts(root).main, matches: globMatch }, landing);
