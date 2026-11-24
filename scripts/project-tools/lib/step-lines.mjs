// @level presentation
// Roadkeeper — a list of steps' lines (steps-run.mjs): a step named by its place in the list and its argument list, a
// PASS line with its seconds, a FAIL line with how it ended and its last lines.

import { controlsReplaced, cutAt } from "../../_text.mjs";
import { tailLines } from "./tail-lines.mjs";

const STEP_SHOWN = 200;    // characters of a step's argument list shown on its line

// a step's argument list as its line shows it
const shown = (argv) => cutAt(controlsReplaced(argv.join(" ")), STEP_SHOWN);

// The k-th step of the list (from 0) as its line names it.
export const stepNamed = (steps, k) => `step ${k + 1} of ${steps.length}  ${shown(steps[k])}`;

// The line of the k-th step of the list, its run `ran` (command-run.mjs's) passed.
export const passLine = (steps, k, ran) => `PASS ${stepNamed(steps, k)}  (${ran.seconds.toFixed(1)} s)`;

// The lines of the k-th step of the list, its run `ran` (command-run.mjs's) red: how it ended, then its last lines.
export const failLines = (steps, k, ran) =>
  [`FAIL ${stepNamed(steps, k)}  ${ran.why}`, ...(ran.tail.trim() ? tailLines(ran.tail) : [])];
