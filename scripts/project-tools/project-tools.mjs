// @level main
// Roadkeeper — the project tools' entry, their one interface: a project's commands file, the green run from it, the
// project's copy of the plugin's lint rules, its tests run by name: red-before and same-cases, whether a commit may
// land, and the check at write, a written file judged by the project's linter. It wires the commands file's reader, the
// worktree and its install, the tested tree, the green stamp, the steps run, the rules' copy, the tests' runs, the
// landing check and the written file's lint (lib/, infrastructure, private), the stack adapters (adapters/, the seam)
// and the structure module's report and file patterns.
//
// What the green reads, under the root of the worktree it is given: docs/roadkeeper/commands.json (lib/commands-file.mjs),
// the lint rules' copy, roadkeeper-lint/, against the plugin's scripts/lint/ (lib/rules-copy.mjs),
// docs/roadkeeper/dependency-rules.md and what the structure check reads, and the tracker snapshot. It writes the install's
// link into a linked worktree that has none and pins what the main checkout pins (lib/worktree.mjs), and the green
// stamp in the main checkout's .run/; the commands it runs are
// the project's own, run from the worktree's root. The copy command writes roadkeeper-lint/ alone. Red-before and same-cases
// read and run what lib/red-before.mjs and lib/same-cases.mjs say.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { todayLocal } from "../_clock.mjs";
import { recordsDir } from "../_files.mjs";
import { readTracker } from "../_tracker.mjs";
import { globMatch, report } from "../structure/structure.mjs";
import { COMMANDS_FILE, readCommands } from "./lib/commands-file.mjs";
import { stampedRecord, writeStamp } from "./lib/green-stamp.mjs";
import { RUN_GREEN, landingRefusal as landingRefusalOf } from "./lib/landing.mjs";
import { redBefore as redBeforeOf } from "./lib/red-before.mjs";
import { COPY_COMMAND, RULES_COPY, copyDiffers, writeCopy } from "./lib/rules-copy.mjs";
import { sameCases as sameCasesOf } from "./lib/same-cases.mjs";
import { stepsPass } from "./lib/steps-run.mjs";
import { testedTree } from "./lib/tested-tree.mjs";
import { checkouts, worktreeInstall, worktreeRoot } from "./lib/worktree.mjs";

// Red-before and same-cases of the worktree holding `dir`, `args` the command's arguments but --root, each line handed
// to `say`: a promise of the exit code. A test-file pattern reads as the structure module's file patterns do.
export const redBefore = (dir, args, say) => redBeforeOf({ dir, args, matches: globMatch }, say);
export const sameCases = (dir, args, say) => sameCasesOf({ dir, args, matches: globMatch }, say);

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

// The green of the worktree holding `dir`, each line handed to `say`: a promise of its exit code, 0 green, 1 red, 2
// refused with nothing run. A rules copy differing from the plugin's is red with nothing run, before the stamp is read,
// so a plugin's new rules reach a stamped tree; a tree the green stamp holds is green with nothing run.
export async function green(dir, say) {
  const root = worktreeRoot(dir);
  if (!root) { say("green: not in a git repository"); return 2; }
  const { commands, refused } = readCommands(root);
  if (refused) { say(`green: ${refused}`); return 2; }
  if (copyDiffers(root)) {
    say(`green: red, ${RULES_COPY}/ differs from the plugin's lint rules; copy them: ${COPY_COMMAND}`);
    return 1;
  }
  const { install } = commands;
  const { said } = worktreeInstall(root, install);
  if (said) say(`green: ${said}`);
  const { main } = checkouts(root);
  const tree = testedTree(root, install);
  const record = tree && stampedRecord(main, tree);
  if (record) { say(`green: this tree (${tree.slice(0, 12)}) ran green on ${record.date}; nothing run`); return 0; }
  const passes = (await stepsPass(root, commands.green, say)) && structurePasses(root, say);
  if (!passes) { say("green: red"); return 1; }
  return stamped({ root, main, tree, install }, say);
}

// What a landing on the default branch is held to in the project at the worktree root `root`: null when nothing, the
// root holding no Roadkeeper docs folder or no commands file; else { patterns }, the commands file's readByNothing, or
// { refusal }, the line saying why the commands file cannot be read and naming the green.
export function landingRules(root) {
  if (!recordsDir(root)) return null;
  try { lstatSync(join(root, ...COMMANDS_FILE.split("/"))); } catch (e) { if (e.code === "ENOENT") return null; }
  const { commands, refused } = readCommands(root);
  return refused ? { refusal: `${refused}; fix it, then ${RUN_GREEN}` } : { patterns: commands.readByNothing };
}

// The refusal, in fixed words, the commit's hash and the green's command, of the first of `commits` (full hashes) that
// may not land from the worktree at `root`; null when each may: the remote's default branch, as its remote-tracking ref
// says, already holds it, its tree holds the green stamp, or it differs from a stamped tree only in files `patterns`
// names, the green's own inputs never among them. `landing`: { remote, home, commits, patterns }, the remote they land
// on and its default branch. A pattern reads as the structure module's file patterns do. Only reads: git and the green
// stamp.
export const landingRefusal = (root, landing) =>
  landingRefusalOf({ root, main: checkouts(root).main, matches: globMatch }, landing);
