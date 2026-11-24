// @level presentation
// Roadkeeper — the green's `{tests}` step's own lines (test-run.mjs): its total line, and its slowest test files with
// what their seconds are (_slowest-lines.mjs's format).

import { formatSlowestLines, TESTS_LABEL } from "../../_slowest-lines.mjs";
import { plural } from "../../_text.mjs";

const OWN_SAID = "each its run's seconds"; // the slowest files' seconds, each a run's own
const SUMMED_SAID = "each its cases' times summed, a file's load time left out"; // each its cases' times summed
// some a run's own, some its cases' times summed
const MIXED_SAID = "each its run's seconds when it ran alone, else its cases' times summed, a file's load time left out";

// The total line of the green's `{tests}` step: its cases, its files, whether all passed, and its seconds.
export const totalLine = ({ cases, files, passes, seconds }) =>
  `${TESTS_LABEL}: ${plural(cases.length, "case")} in ${plural(files.length, "file")}, all pass: ${passes ? "True" : "False"} ` +
  `(${seconds.toFixed(1)} s)`;

// What the files' seconds (each { file, seconds, summed }) are: each a run's own, each its cases' times summed, or some
// of each.
function describeSeconds(timed) {
  if (!timed.some((t) => t.summed)) return OWN_SAID;
  return timed.some((t) => !t.summed) ? MIXED_SAID : SUMMED_SAID;
}

// The lines naming the slowest test files, each with its seconds (formatSlowestLines): `timed` every file timed, each
// { file, seconds, summed }, `slowest` those named, slowest first, `untimed` how many files no time was read for.
export const slowestLines = ({ timed, slowest, untimed }) =>
  formatSlowestLines({ how: describeSeconds(timed), slowest, untimed });
