// @level kernel
// Roadkeeper — a name as a line shows it: its controls replaced, cut to a fixed length.

import { controlsReplaced, cutAt } from "../../_text.mjs";

const NAME_SHOWN = 200; // characters of a refused file's name shown

// A file name from the command line as a refusal shows it: its controls replaced, cut at NAME_SHOWN.
export const shownName = (name) => cutAt(controlsReplaced(name), NAME_SHOWN);
