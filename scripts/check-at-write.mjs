#!/usr/bin/env node
// @level main
// Roadkeeper — the check at write (PostToolUse hook on Write and Edit, scripts/hooks.json).
//
// Judges the file a Write or Edit names, its `file_path` (against the input's `cwd`, else the hook's own, when
// relative), with its project's own linter: the commands file's `lintFile`, run from the root of the worktree holding
// the file (scripts/project-tools/). Only inside the session's own project: the clone CLAUDE_PROJECT_DIR names, else
// the input's `cwd`, else the hook's own, its linked worktrees included; a stranger's repository, cloned into the
// project or elsewhere, never has its `lintFile` run. Refuses (exit 2, stderr) with a fixed line, then a line it builds
// per breach: the file's path, the line, the rule's id and its numbers, `src/route.ts:88 max-lines-per-function 52 >
// 40`; never the linter's message. Unused names are left to the commit. A `lintFile` run that did not pass with no
// breach read (the linter crashed, is not installed, ran out of time, or a JS/TS report held no error, a warning
// failing it) is refused too, in one line: how it ended, in fixed words, numbers and the program's name (its exit
// code), and to run the commands file's `lintFile` on the file's path to read the rest; never the linter's text. ESLint's
// own sentences, read in both stacks (Roadkeeper's check passes them through), are named in fixed words: a suppression
// record counting more breaches than the file has now, refused even when ESLint reports no breach, with how to lower it,
// after the breaches' lines when there are any, one line naming each record that holds rows for the file (one unnamed
// when none does); ESLint stopped on an error of its own before judging the file,
// with its exit code and the command to run. One that passed with output its adapter cannot read is refused in one
// fixed line. The session hears either on every write until the linter is fixed. Last in a refusal, what the project's
// suppression records say of the file: a rule past the count a record allows (the record's path, the count and the
// file's breaches of the rule now), or, the file holding no row of its own, rows for a file of its name under a path
// gone, to re-key to the file's path; never a row's path. A linked worktree with no main checkout's install linked, the
// linter not run, is refused too: a fixed line says where to install, in the worktree when its pins differ from the main
// checkout's, in the main checkout when that has none. Lets
// pass, saying nothing: a clean file, a file the linter does not take, no `lintFile`, a file in no Roadkeeper project or
// outside the session's. Input naming no file lets pass, said on stderr.

import { resolve } from "node:path";
import { hookMessage, letPass, readInput } from "./_hook.mjs";
import { CAUSES, writtenFileBreaches } from "./project-tools/project-tools.mjs";

const HOOK = "check-at-write"; // the name its lines start with
const SAY = hookMessage(HOOK, "the project's linter refuses the file written; fix each line:"); // the refusal's first line
const UNREAD = hookMessage(HOOK, "the project's lintFile ran, but its output could not be read; "
  + "fix the linter or the commands file's lintFile"); // the refusal of a passed run no breach can be read from
// The refusal of a run that did not pass with no breach read: how it ended, and the command that says the rest.
const buildFailedLine = ({ why, path }) => hookMessage(HOOK, `the project's lintFile did not pass (${why}), and no breach `
  + `could be read from its output; run the commands file's lintFile on ${path} to read the rest`);
const OVER_COUNTED = hookMessage(HOOK, "a suppression record counts more breaches of a rule in this file than it has now; "
  + "lower it with the linter's `--prune-suppressions`"); // the over-counted refusal when no record holds a row for the file
// The refusal of a run whose suppression record at `record`, holding rows for the file, counts more breaches than the file
// has: how to lower it.
const buildOverCountedLine = (record) => hookMessage(HOOK, `the suppression record \`${record}\` counts more breaches in `
  + "this file than it has now; lower it with the linter's `--prune-suppressions`");
// The refusal of a run ESLint stopped on an error of its own: how it ended when it did not pass, where the error lies,
// and the command that shows it.
const buildEslintStoppedLine = ({ why, path }) => hookMessage(HOOK, `ESLint stopped on an error of its own${why ? ` (${why})` : ""} `
  + "before judging the file: its config, a plugin, or a file the config imports; run the commands file's lintFile on "
  + `${path} to read it`);
// each cause an adapter names (project-tools/adapters/adapters.mjs), its refusal's lines for a judgement: over-counted,
// one per record holding rows for the file
const CAUSE_LINES = new Map([[CAUSES.failed, (judged) => [buildFailedLine(judged)]], [CAUSES.unread, () => [UNREAD]],
  [CAUSES.overCounted, ({ holdingRecords }) => (holdingRecords.length ? holdingRecords.map(buildOverCountedLine) : [OVER_COUNTED])],
  [CAUSES.eslintStopped, (judged) => [buildEslintStoppedLine(judged)]]]);
// What a suppression record says of a rule past the count it allows the written file.
const buildPastCountLine = ({ record, rule, allowed, now }) => hookMessage(HOOK, `the suppression record \`${record}\` `
  + `allows ${allowed} \`${rule}\` in this file; it now has ${now}`);
// What a suppression record says beside a refusal of the file shown at `path` when it holds rows for a file of the
// written file's name under a path gone: to re-key them.
const buildMovedRowsLine = ({ record, name }, path) => hookMessage(HOOK, `the suppression record \`${record}\` holds rows `
  + `for a file named \`${name}\` at a path that no longer exists; re-key them to \`${path}\``);

async function main() {
  const input = readInput();
  const path = input.tool_input?.file_path;
  if (typeof path !== "string" || !path) return letPass(HOOK, "no file_path in the input");
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const project = process.env.CLAUDE_PROJECT_DIR || cwd; // Claude Code's project folder, which every hook gets
  const judged = await writtenFileBreaches(resolve(cwd, path), project);
  const passes = judged.lines?.length === 0 && !judged.cause; // no breach, no cause and no install to make
  if (passes) return 0;
  process.stderr.write(refusalLines(judged).join("\n") + "\n");
  return 2;
}

// The refusal's lines for a judgement (writtenFileBreaches) that does not pass: the breaches' lines, then the cause's
// line, the cause's alone when there is no breach; then what the suppression records say. A cause CAUSE_LINES holds no
// line for stops the hook, naming it.
function refusalLines(judged) {
  if (judged.said) return [hookMessage(HOOK, judged.said)];
  const notes = [...judged.pastCounts.map(buildPastCountLine),
    ...judged.movedRows.map((n) => buildMovedRowsLine(n, judged.path))];
  if (!judged.cause) return [SAY, ...judged.lines, ...notes];
  const causeLines = CAUSE_LINES.get(judged.cause);
  if (!causeLines) throw new Error(`check-at-write: no refusal line for the adapter's cause ${judged.cause}`);
  return [...(judged.lines.length ? [SAY, ...judged.lines] : []), ...causeLines(judged), ...notes];
}

process.exitCode = await main();
