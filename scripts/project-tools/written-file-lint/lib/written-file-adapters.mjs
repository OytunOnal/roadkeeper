// @level infrastructure
// Roadkeeper — what the check at write's judgement reads (written-file-judgement.mjs), handed to it by the module's
// entry: the written file placed in the worktree holding it, whether the session's clone holds that worktree, the
// project's commands file, whether git ignores the file, its lint run, and what the project's suppression records say
// of it (suppression-records.mjs). The lint runs `lintFile` from the worktree's root (command-run.mjs), the main
// checkout's install linked in when a linked worktree has none and pins what the main checkout pins (worktree.mjs),
// else the linter not run and that said; `{file}`, in any of its arguments, the file's path from that root. The stack's
// adapter reads the breaches from the run's output, its unused names left to the commit, and names a cause when none is
// read or ESLint's own sentence names one beside them, given back with the run's `why`, how it ended (command-run.mjs).

import { dirname } from "node:path";
import { pathFrom } from "../../../_files.mjs";
import { git } from "../../../_git.mjs";
import { adapterOf } from "../../adapters/adapters.mjs";
import { commandEnv, runCommandWithin } from "../../lib/command-run.mjs";
import { readCommands } from "../../lib/commands-file.mjs";
import { sameClone, worktreeInstall, worktreeRoot } from "../../lib/worktree.mjs";
import { findRecordNotes, readSuppressionRecords } from "./suppression-records.mjs";
import { FILE } from "./written-file-judgement.mjs";

const LINT_TIMEOUT = 75 * 1000;    // milliseconds the linter may take: under the hook's 90 s, so the hook ends it

// The written file's path from the root of the worktree holding it, with `/`: { root, path }, or null outside one.
function placed(file) {
  const root = worktreeRoot(dirname(file));
  const path = root && pathFrom(root, file);
  return path ? { root, path } : null;
}

// whether git ignores the path at the root: run output and scratch, not the project's code
function ignored(root, path) {
  try { git(["check-ignore", "-q", "--", path], root); return true; } catch { return false; }
}

// The lint run's read for the written file: its adapter's { breaches } or { cause }, with the run's `why`, how a run
// that did not pass ended; or { said }, the line saying why no main checkout's install is linked, the linter not run. `run`: { root, path, commands }.
async function linted({ root, path, commands }) {
  const adapter = adapterOf(commands.stack);
  const { said } = worktreeInstall(root, commands.install);
  if (said) return { said };
  const argv = commands.lintFile.map((a) => a.replaceAll(FILE, path));
  const ran = await runCommandWithin(argv, { cwd: root, env: commandEnv(root), timeout: LINT_TIMEOUT });
  return { ...adapter.breaches({ file: path, output: ran.tail, passed: ran.passed }), why: ran.why };
}

// What the project's suppression records at `root`, as its `commands` list them, say of the file at `path` with its
// breaches counted by rule `counts` (suppression-records.mjs's findRecordNotes).
const recordNotes = (root, commands, { path, counts }) =>
  findRecordNotes(root, readSuppressionRecords(root, commands), { path, counts });

// The adapters the judgement is handed: { placed, sameClone, readCommands, ignored, linted, recordNotes }.
export const WRITTEN_FILE_ADAPTERS = Object.freeze({ placed, sameClone, readCommands, ignored, linted, recordNotes });
