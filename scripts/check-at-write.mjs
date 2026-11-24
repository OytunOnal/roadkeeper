#!/usr/bin/env node
// @level main
// Roadkeeper — the check at write (PostToolUse hook on Write and Edit, scripts/hooks.json).
//
// Judges the file a Write or Edit names, its `file_path` (against the input's `cwd`, else the hook's own, when
// relative), with its project's own linter: the commands file's `lintFile`, run from the root of the worktree holding
// the file (scripts/project-tools/). Only inside the session's own project: the clone CLAUDE_PROJECT_DIR names, else
// the input's `cwd`, else the hook's own, its linked worktrees included; a stranger's repository, cloned into the
// project or elsewhere, never has its `lintFile` run. Refuses (exit 2, stderr) with the lines the project tools build,
// in the order and words scripts/project-tools/written-file-lint/written-file-lint.mjs's header says; the hook only says
// them. Lets pass, saying nothing, what they do not refuse. Input naming no file lets pass, said on stderr.

import { resolve } from "node:path";
import { letPass, readInput } from "./_hook.mjs";
import { CHECK_AT_WRITE_HOOK, writtenFileRefusal } from "./project-tools/project-tools.mjs";

// Says the project tools' refusal of the file the input names, each line as they built it (writtenFileRefusal).
async function main() {
  const input = readInput();
  const path = input.tool_input?.file_path;
  if (typeof path !== "string" || !path) return letPass(CHECK_AT_WRITE_HOOK,"no file_path in the input");
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const project = process.env.CLAUDE_PROJECT_DIR || cwd; // Claude Code's project folder, which every hook gets
  const refusal = await writtenFileRefusal(resolve(cwd, path), project);
  if (!refusal.length) return 0;
  process.stderr.write(refusal.join("\n") + "\n");
  return 2;
}

process.exitCode = await main();
