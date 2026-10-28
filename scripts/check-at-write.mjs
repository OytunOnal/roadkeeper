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
// 40`; never the linter's message. Unused names are left to the commit. A `lintFile` run whose output cannot be read
// (the linter crashed, is not installed, or printed what its adapter cannot parse) is refused too, in one fixed line,
// so the session hears it on every write until the linter is fixed; so is a linked worktree whose pins differ from its
// main checkout's, whose install is then not linked, the linter not run: a fixed line says to install there. Lets
// pass, saying nothing: a clean file, a file the linter does not take, no `lintFile`, a file in no Roadkeeper project or
// outside the session's. Input naming no file lets pass, said on stderr.

import { resolve } from "node:path";
import { hookMessage, letPass, readInput } from "./_hook.mjs";
import { writtenFileBreaches } from "./project-tools/project-tools.mjs";

const HOOK = "check-at-write"; // the name its lines start with
const SAY = hookMessage(HOOK, "the project's linter refuses the file written; fix each line:"); // the refusal's first line
const UNREAD = hookMessage(HOOK, "the project's lintFile ran, but its output could not be read; "
  + "fix the linter or the commands file's lintFile"); // the refusal of a run no breach can be read from

async function main() {
  const input = readInput();
  const path = input.tool_input?.file_path;
  if (typeof path !== "string" || !path) return letPass(HOOK, "no file_path in the input");
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const project = process.env.CLAUDE_PROJECT_DIR || cwd; // Claude Code's project folder, which every hook gets
  const judged = await writtenFileBreaches(resolve(cwd, path), project);
  if (judged.lines && !judged.lines.length) return 0;
  process.stderr.write(refusalLines(judged).join("\n") + "\n");
  return 2;
}

// The refusal's lines for a judgement (writtenFileBreaches) that does not pass.
function refusalLines({ lines, unread, said }) {
  if (said) return [hookMessage(HOOK, said)];
  return unread ? [UNREAD] : [SAY, ...lines];
}

process.exitCode = await main();
