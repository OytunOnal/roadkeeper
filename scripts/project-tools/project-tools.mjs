// @level main
// Roadkeeper — the project tools' entry, their one interface: a project's commands file, the green run from it, the
// project's copy of the plugin's lint rules, its tests run by name: red-before and same-cases, a change's reader tests,
// whether a commit may land, and the check at write, a written file judged by the project's linter. It wires the
// commands file's reader, the worktree and its install, the tested tree, the green stamp and the stamped tree near a
// tree, the green's inputs and doc tests, the steps run, the rules' copy, the tests' runs, the reader scan, the landing
// check and the written file's lint (lib/, infrastructure, private), the stack adapters (adapters/, the seam) and the
// structure module's report and file patterns.
//
// What the green reads, under the root of the worktree it is given: docs/roadkeeper/commands.json
// (lib/commands-file.mjs), the lint rules' copy, roadkeeper-lint/, against the plugin's scripts/lint/
// (lib/rules-copy.mjs), docs/roadkeeper/dependency-rules.md and what the structure check reads, and the tracker
// snapshot. It writes the install's link into a linked worktree that has none and pins what the main checkout pins
// (lib/worktree.mjs), and the green stamp in the main checkout's .run/; the commands it runs are the project's own, run
// from the worktree's root, a `{tests}` step's over the test files git lists there and the doc tests' over the files
// the commands file names, none through a link, their results in a throwaway folder of the OS temp folder. A full green
// also reads those test files' text, each a plain file under the reader scan's cap, against the paths of the files
// `readByNothing` lists. The copy command writes roadkeeper-lint/ alone. Red-before, same-cases and reader-tests read
// and run what lib/red-before.mjs, lib/same-cases.mjs and lib/reader-tests.mjs say.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { todayLocal } from "../_clock.mjs";
import { recordsDir } from "../_files.mjs";
import { readTracker } from "../_tracker.mjs";
import { globMatch, report } from "../structure/structure.mjs";
import { COMMANDS_FILE, declaresDocTests, readCommands } from "./lib/commands-file.mjs";
import { docTestListsPass, docTestLists, docTestsPass, greenInputs } from "./lib/green-doc-tests.mjs";
import { stampedRecord, writeStamp } from "./lib/green-stamp.mjs";
import { OWN_STAMP_ONLY, RUN_GREEN, landingRefusal as landingRefusalOf } from "./lib/landing.mjs";
import { nearStamp } from "./lib/near-stamp.mjs";
import { readerTests as readerTestsOf } from "./lib/reader-tests.mjs";
import { redBefore as redBeforeOf } from "./lib/red-before.mjs";
import { RULES_COPY, writeCopy } from "./lib/rules-copy.mjs";
import { sameCases as sameCasesOf } from "./lib/same-cases.mjs";
import { stepsPass } from "./lib/steps-run.mjs";
import { testsStepPasses } from "./lib/test-run.mjs";
import { testedTree } from "./lib/tested-tree.mjs";
import { checkouts, worktreeInstall, worktreeRoot } from "./lib/worktree.mjs";

// Red-before and same-cases of the worktree holding `dir`, `args` the command's arguments but --root, each line handed
// to `say`: a promise of the exit code. A test-file pattern reads as the structure module's file patterns do.
export const redBefore = (dir, args, say) => redBeforeOf({ dir, args, matches: globMatch }, say);
export const sameCases = (dir, args, say) => sameCasesOf({ dir, args, matches: globMatch }, say);

// reader-tests of the worktree holding `dir`, `args` the command's arguments but --root, each line handed to `say`: a
// promise of the exit code (lib/reader-tests.mjs); READER_TESTS_RUN, its option running the reader tests found.
export const readerTests = (dir, args, say) => readerTestsOf({ dir, args, matches: globMatch }, say);
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
// { root, main, tree, install }, the worktree, its main checkout, the tested tree and the install folder.
function stamped(run, say) {
  const { root, main, tree, install } = run;
  if (tree && testedTree(root, install) !== tree) { say("green: red, the steps changed the tree"); return 1; }
  const written = tree && !configOverridden() && writeStamp(main, tree);
  say(written ? `green: stamped ${tree.slice(0, 12)}` : "green: green, no stamp written");
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
  if (record) say(`green: this tree (${tree.slice(0, 12)}) ran green on ${record.date}; nothing run`);
  return Boolean(record);
}

// Every step of the commands file, a `{tests}` step running the project's tests by `tests`, testSetup's
// (lib/test-run.mjs), then the structure check: a promise of whether all passed.
async function everyStepPasses({ root, commands, tests }, say) {
  const testsStep = tests && ((sayTests) => testsStepPasses(tests, sayTests));
  return (await stepsPass({ root, steps: commands.green, testsStep }, say)) && structurePasses(root, say);
}

// The green's end once its steps ran: red when they did not pass, else the run's tree stamped (stamped).
function finished(run, passes, say) {
  if (passes) return stamped(run, say);
  say("green: red");
  return 1;
}

// The green of the worktree holding `dir`, each line handed to `say`: a promise of its exit code, 0 green, 1 red, 2
// refused with nothing run. A rules copy differing from the plugin's is red with nothing run, before the stamp is read,
// so a plugin's new rules reach a stamped tree; a tree the green stamp holds is green with nothing run; a `docTests` or
// `notDocTests` entry naming no file is red with nothing run; a tree differing from a stamped one only in files no step
// reads (lib/near-stamp.mjs) runs its doc tests alone; any other is first held to the doc-test lists, red there with
// nothing run, then runs every step, then the structure check (lib/green-doc-tests.mjs). A `["{tests}"]` step runs the
// project's test files by `runTests`, as red-before and same-cases do (lib/test-run.mjs); a commands file holding one,
// or `docTests`, that cannot run them is refused.
export async function green(dir, say) {
  const root = worktreeRoot(dir);
  if (!root) { say("green: not in a git repository"); return 2; }
  const { code, commands, tests } = greenInputs({ root, matches: globMatch }, say);
  if (code !== undefined) return code;
  const run = testedRun(root, commands.install, say);
  if (ranGreen(run, say)) return 0;
  const lists = docTestLists(root, commands);
  if (lists.missing) { say(`green: red, ${lists.missing}`); return 1; }
  const near = run.tree && nearStamp({ root, main: run.main, matches: globMatch }, run.tree, commands.readByNothing);
  if (near) return finished(run, await docTestsPass({ tests, files: lists.docTests, tree: run.tree, near }, say), say);
  if (!docTestListsPass({ root, commands, named: lists.named, matches: globMatch }, say)) return 1;
  return finished(run, await everyStepPasses({ root, commands, tests }, say), say);
}

// What a landing on the default branch is held to in the project at the worktree root `root`: null when nothing, the
// root holding no Roadkeeper docs folder or no commands file; else { patterns }, the commands file's readByNothing,
// OWN_STAMP_ONLY (lib/landing.mjs) where it declares doc tests, whose green runs them and stamps the tree; or
// { refusal }, the line saying why the commands file cannot be read and naming the green.
export function landingRules(root) {
  if (!recordsDir(root)) return null;
  try { lstatSync(join(root, ...COMMANDS_FILE.split("/"))); } catch (e) { if (e.code === "ENOENT") return null; }
  const { commands, refused } = readCommands(root);
  if (refused) return { refusal: `${refused}; fix it, then ${RUN_GREEN}` };
  return { patterns: declaresDocTests(commands) ? OWN_STAMP_ONLY : commands.readByNothing };
}

// The refusal, in fixed words, the commit's hash and the green's command, of the first of `commits` (full hashes) that
// may not land from the worktree at `root`; null when each may: the remote's default branch, as its remote-tracking ref
// says, already holds it, its tree holds the green stamp, or it differs from a stamped tree only in files `patterns`
// names (OWN_STAMP_ONLY: none), the green's own inputs never among them. `landing`: { remote, home, commits,
// patterns }, the remote they land on and its default branch. A pattern reads as the structure module's file patterns
// do. Only reads: git and the green stamp.
export const landingRefusal = (root, landing) =>
  landingRefusalOf({ root, main: checkouts(root).main, matches: globMatch }, landing);
