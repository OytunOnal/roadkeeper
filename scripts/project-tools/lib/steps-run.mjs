// @level infrastructure
// Roadkeeper — a list of steps run in order from a tree's root, each an argument list (command-run.mjs), a PASS or FAIL line
// each; the first red one stops the list, its last lines shown. A `["{tests}"]` step, given a runner of the project's
// tests, is run by it, which says its own lines.

import { controlsReplaced, cutAt } from "../../_text.mjs";
import { commandEnv, runCommand } from "./command-run.mjs";

const TAIL_LINES = 40;     // a red step's last lines shown: its failure and the summary its runner prints
const STEP_SHOWN = 200;    // characters of a step's argument list shown on its line
const TESTS_STEP = "{tests}"; // the step, an argument of its own, that runs the project's tests

// a step's argument list as its line shows it
const shown = (argv) => cutAt(controlsReplaced(argv.join(" ")), STEP_SHOWN);

// Whether the step is `["{tests}"]`, the project's tests run.
export const isTestsStep = (step) => step.length === 1 && step[0] === TESTS_STEP;

// The last TAIL_LINES lines of a run's output, each indented.
export const tailLines = (tail) => tail.replace(/\r\n?/g, "\n").trimEnd().split("\n").slice(-TAIL_LINES).map((l) => "     " + controlsReplaced(l.replace(/\t/g, "  ")));

// Each step run in order from the tree's root, a line each; stops at the first red one, its last lines shown.
// Whether every step passed. `run`: { root, steps, testsStep }, `testsStep(say)` (none: a `{tests}` step runs as a
// program) a promise of whether the project's tests passed, its lines handed to `say`.
export async function stepsPass({ root, steps, testsStep }, say) {
  const env = commandEnv(root);
  for (const [k, step] of steps.entries()) {
    if (testsStep && isTestsStep(step)) {
      if (await testsStep(say)) continue;
      return false;
    }
    const ran = await runCommand(step, root, env);
    const at = `step ${k + 1} of ${steps.length}  ${shown(step)}`;
    if (ran.passed) { say(`PASS ${at}  (${ran.seconds.toFixed(1)} s)`); continue; }
    say(`FAIL ${at}  ${ran.why}`);
    if (ran.tail.trim()) for (const line of tailLines(ran.tail)) say(line);
    return false;
  }
  return true;
}
