// @level infrastructure
// Roadkeeper — a list of steps run in order from a tree's root, each an argument list (command-run.mjs), a PASS or FAIL line
// each, in the words handed in (step-lines.mjs); the first red one stops the list, its last lines shown. A `["{tests}"]`
// step (commands-fields.mjs), given a runner of the project's tests, is run by it, which says its own lines.

import { isTestsStep } from "./commands-fields.mjs";
import { commandEnv, runCommand } from "./command-run.mjs";

// Each step from the `from`-th (0: the first) run in order from the tree's root, a line each; stops at the first red
// one, its last lines shown. A promise of { at, tests }: `at` that step's index, -1 when every step passed; `tests` the
// last `{tests}` step's run, null when none ran. `run`: { root, steps, testsStep, from, words }, `testsStep(say)` (none:
// a `{tests}` step runs as a program) a promise of the project's tests' run, { passes, … }, its lines handed to `say`;
// `words` the lines the runs say, as the entry hands them in: { passLine, failLines }, the steps' (step-lines.mjs).
export async function firstRedStep({ root, steps, testsStep, from = 0, words }, say) {
  const env = commandEnv(root);
  let tests = null;
  for (let k = from; k < steps.length; k++) {
    const step = steps[k];
    if (testsStep && isTestsStep(step)) {
      tests = await testsStep(say);
      if (tests.passes) continue;
      return { at: k, tests };
    }
    const ran = await runCommand(step, root, env);
    if (ran.passed) { say(words.passLine(steps, k, ran)); continue; }
    for (const line of words.failLines(steps, k, ran)) say(line);
    return { at: k, tests };
  }
  return { at: -1, tests };
}
