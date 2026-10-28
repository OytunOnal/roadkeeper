#!/usr/bin/env node
// @level main
// Roadkeeper — The Road redraws itself (PostToolUse hook on Bash and PowerShell).
//
// Reads the hook's input. After a gh command that writes to the tracker (an issue, a label, a milestone, a pull
// request that merges or closes), in a project with docs/roadkeeper/ on its default branch, it runs scripts/road.mjs in
// the project's root, which writes the page. Runs in the background (`async` in scripts/hooks.json): the tool call
// goes on without it. Leaves the commit to the session. Says one line in fixed words: the page redrawn, or the redraw
// failed; off the default branch, and after any other command, it says nothing. Always exits 0.

import { fileURLToPath } from "node:url";
import { recordsDir } from "./_files.mjs";
import { drawRoadAtHome, readInput, repoRoot } from "./_hook.mjs";

const ROAD = fileURLToPath(new URL("./road.mjs", import.meta.url)); // found from this file: a hook runs anywhere
const DRAW_TIMEOUT = 110000; // milliseconds for a live redraw, under the 120 s scripts/hooks.json gives the hook
// fixed text, the variable left for the reader to expand: the plugin's real path would reach the session
const DRAW_FAILED = "The Road could not be redrawn; run the drawing script to see why: "
  + "node ${CLAUDE_PLUGIN_ROOT}/scripts/road.mjs in the project root.";

// A gh call that changes what The Road draws.
const WRITES = [
  /\bgh\s+issue\s+(create|edit|close|reopen|comment|delete|transfer|lock|unlock|pin|unpin)\b/,
  /\bgh\s+label\s+(create|edit|delete|clone)\b/,
  /\bgh\s+pr\s+(merge|close|reopen)\b/,
];
// `gh api` writes when it carries a field, a method or an input, and touches what the page draws.
const API_CALL = /\bgh\s+api\b[^\n;&|]*/g;
const API_TARGET = /\b(milestones|issues|labels)\b/;
const API_WRITE = /\s(-f|-F|-X|--field|--raw-field|--method|--input)\b/;

function writesTracker(command) {
  const c = String(command || "");
  if (WRITES.some((re) => re.test(c))) return true;
  return (c.match(API_CALL) || []).some((call) => API_TARGET.test(call) && API_WRITE.test(call));
}

function say(text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } }) + "\n");
}

function main() {
  const input = readInput();
  if (!writesTracker(input.tool_input && input.tool_input.command)) return;
  const root = repoRoot(input.cwd || process.cwd());
  if (!root || !recordsDir(root)) return;
  const drawn = drawRoadAtHome(root, ROAD, { offline: false, timeout: DRAW_TIMEOUT });
  if (drawn === "drawn") say("The Road was redrawn; the page goes with the next commit.");
  else if (drawn === "failed") say(DRAW_FAILED);
}

try { main(); } catch { /* never block the tool */ }
