// @level domain
// Roadkeeper — the lines the green's `{tests}` step prints naming its slowest test files: written by
// scripts/project-tools/lib/test-run.mjs, read back from a green's output by scripts/slice-runs/lib/green-runs.mjs.

import { plural } from "./_text.mjs";

export const TESTS_LABEL = "tests"; // the green's `{tests}` step's lines start with it
export const SLOWEST_MAX = 5; // test files the `{tests}` step names as its slowest
const HEADING = `${TESTS_LABEL}: slowest test files`; // the heading's opening, or the line saying times are not given
const NOT_GIVEN = `${HEADING}: times not given`; // said when no file has a time
const UNTIMED = `${TESTS_LABEL}: times not given: `; // the count of files with no times, after the files
const FILE_LINE = /^ {2}\d{1,9}\.\d{3} s {2}\S/; // a file with its seconds, under the heading
const LABEL_LENGTH = `${TESTS_LABEL}: `.length; // characters of a line's label and its separator

// The lines naming the slowest test files: with `slowest` empty, one saying the times are not given; else the heading
// saying how their seconds were found (`how`), each of `slowest` ({ file, seconds }) with its seconds, then one
// counting the `untimed` files, when any.
export function formatSlowestLines({ how, slowest, untimed }) {
  if (!slowest.length) return [NOT_GIVEN];
  const untimedLine = untimed ? [`${UNTIMED}${plural(untimed, "file")}`] : [];
  return [`${HEADING}, ${how}:`, ...slowest.map(({ file, seconds }) => `  ${seconds.toFixed(3)} s  ${file}`), ...untimedLine];
}

// The lines a green printed naming its slowest test files, each without its step's label and indent: the heading,
// each file with its seconds and the count of files with no times; or the line saying times are not given. None when
// it printed none.
export function findSlowestPrinted(text) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => line.startsWith(HEADING));
  if (at < 0) return [];
  const next = lines.slice(at + 1, at + 1 + SLOWEST_MAX);
  const notFile = next.findIndex((line) => !FILE_LINE.test(line));
  const files = next.slice(0, notFile < 0 ? next.length : notFile);
  const after = lines[at + 1 + files.length] || "";
  const untimed = after.startsWith(UNTIMED) ? [after.slice(LABEL_LENGTH)] : [];
  return [lines[at].slice(LABEL_LENGTH), ...files.map((line) => line.trim()), ...untimed];
}
