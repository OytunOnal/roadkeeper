// @level infrastructure
// Roadkeeper — one run's greens from its transcript's entries in the slice window: each a call whose shell command line
// runs green.mjs, ended as command-runs.mjs ends a call; its slowest test files from its own result.

import { findSlowestPrinted } from "../../_slowest-lines.mjs";
import { findCommandRuns } from "./command-runs.mjs";

// node running a script named green.mjs, at a command's start: the command's own, or after a chain's `&&`, `;`, `|`
// or `(`; a command only naming the file (a grep, a Read) runs none
const RUNS_GREEN = /(?:^|[;&|(])\s*node(?:\.exe)?\s+["']?(?:[^\s"';&|()]*[\\/])?green\.mjs["']?(?=$|[\s;&|)])/;

// whether a command runs the green
const isGreenCommand = (command) => RUNS_GREEN.test(command);

// The greens of a run whose `entries` (read-entry-facts.mjs's facts, in the file's order) fall in the window, in the order they
// were called: each { started, seconds, outcome, slowest, outputFile }, seconds and outcome null when no end is seen,
// slowest findSlowestPrinted's lines from its result, none for a notification's end, outputFile the file its
// notification names, else null.
export const findGreens = (entries) => findCommandRuns(entries, isGreenCommand).map(({ printed, ...green }) =>
  ({ ...green, slowest: printed === null ? [] : findSlowestPrinted(printed) }));
