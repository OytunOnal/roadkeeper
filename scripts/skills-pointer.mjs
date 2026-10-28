#!/usr/bin/env node
// @level main
// Roadkeeper — the skills pointer.
//
// In a project with docs/roadkeeper/, says LINE so a session whose context was just emptied or compacted works from the
// skill files; while the project has no commands file, docs/roadkeeper/commands.json, SETUP_LINE after it, so the session
// opens a slice that sets up Roadkeeper's tools. The lines go to the session only (additionalContext). Reads the hook's
// input and finds the project's root from the filesystem alone: it reads no tracker and runs no program, so it answers
// within the hook's timeout with no PATH. Said on any branch. Silent outside a Roadkeeper project. Always exits 0.

import { lstatSync } from "node:fs";
import { join } from "node:path";
import { projectRecordsOrNull, readInput } from "./_hook.mjs";

// fixed words only: the skills open by name, so no path, and with it no home folder, reaches the session
const LINE = "This project runs on Roadkeeper: open the Roadkeeper skill the current work follows with the Skill tool "
  + "(`roadkeeper:slice`, `roadkeeper:steward`) and work its steps from the file.";
// fixed words too: the reference is named inside the skill's folder, which the session sees once the skill opens
const SETUP_LINE = "Roadkeeper's tools are not set up here: this project has no `docs/roadkeeper/commands.json`. Open a slice of "
  + "its own for the setup, which follows `references/project-tools.md` in the `roadkeeper:slice` skill's folder; a running "
  + "slice goes on without it.";
// the commands file's name in docs/roadkeeper/ (the project tools' COMMANDS_FILE): their entry loads in about three bare node
// starts, past this hook's budget
const COMMANDS = "commands.json";

// whether anything lies at the commands file's path: a link or a malformed file is the tools' to refuse, and the merge
// guard holds it as set up too
function hasCommands(records) {
  try { lstatSync(join(records, COMMANDS)); return true; } catch (e) { return e.code !== "ENOENT"; }
}

function main() {
  const records = projectRecordsOrNull(readInput().cwd || process.cwd());
  if (!records) return;
  const context = hasCommands(records) ? LINE : `${LINE}\n${SETUP_LINE}`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }) + "\n");
}

try { main(); } catch { /* a pointer never stops a session */ }
