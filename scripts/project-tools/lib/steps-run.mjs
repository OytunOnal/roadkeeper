// @level infrastructure
// Roadkeeper — a list of steps run in order from a tree's root, each an argument list (command-run.mjs), a PASS or FAIL line
// each; the first red one stops the list, its last lines shown.

import { controlsReplaced, cutAt } from "../../_text.mjs";
import { commandEnv, runCommand } from "./command-run.mjs";

const TAIL_LINES = 40;     // a red step's last lines shown: its failure and the summary its runner prints
const STEP_SHOWN = 200;    // characters of a step's argument list shown on its line

// a step's argument list as its line shows it
const shown = (argv) => cutAt(controlsReplaced(argv.join(" ")), STEP_SHOWN);

// The last TAIL_LINES lines of a run's output, each indented.
export const tailLines = (tail) => tail.replace(/\r\n?/g, "\n").trimEnd().split("\n").slice(-TAIL_LINES).map((l) => "     " + controlsReplaced(l.replace(/\t/g, "  ")));

// Each step run in order from the tree's root, a line each; stops at the first red one, its last lines shown.
// Whether every step passed.
export async function stepsPass(root, steps, say) {
  const env = commandEnv(root);
  for (const [k, step] of steps.entries()) {
    const ran = await runCommand(step, root, env);
    const at = `step ${k + 1} of ${steps.length}  ${shown(step)}`;
    if (ran.passed) { say(`PASS ${at}  (${ran.seconds.toFixed(1)} s)`); continue; }
    say(`FAIL ${at}  ${ran.why}`);
    if (ran.tail.trim()) for (const line of tailLines(ran.tail)) say(line);
    return false;
  }
  return true;
}
