// @level kernel
// Roadkeeper — a program's output cut to its last lines, as shown under a line about the run: each indented, tabs
// widened, controls replaced.

import { controlsReplaced } from "../../_text.mjs";

const TAIL_LINES = 40; // a run's last lines shown: its failure and the summary its program prints

// The last TAIL_LINES lines of a run's output, each indented.
export const tailLines = (tail) => tail.replace(/\r\n?/g, "\n").trimEnd().split("\n").slice(-TAIL_LINES).map((l) => "     " + controlsReplaced(l.replace(/\t/g, "  ")));
