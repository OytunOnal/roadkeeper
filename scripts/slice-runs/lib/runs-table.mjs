// @level presentation
// Roadkeeper — the retro's table of a slice's runs, as Markdown, each run's transcript listed under it, and what the
// read skipped or shortened.

import { describeHeadingAsTime, readSlowestFile } from "../../_slowest-lines.mjs";
import { controlsReplaced, cutAt, plural } from "../../_text.mjs";

const NAME_CAP = 80; // characters of a run's name shown: an agent's description is a transcript's text
const TRANSCRIPTS_HEADING = "Transcripts, in the table's order:"; // the list of runs' transcripts under the table
const GREENS_HEADING = "Greens, each with its slowest test files:"; // the list of greens under the table
const GREEN_LINE_CAP = 200; // characters of a line listing greens shown: a test file's path is a green's printed text
const MEGABYTE = 1024 * 1024; // bytes in a megabyte, as a line's cap is said
const MINUTE = 60; // seconds in a minute
const HOUR = 3600; // seconds in an hour, from which a time is said to the minute
const MINUTES_IN_HOUR = 60; // minutes in an hour, as an hour-long time splits its rounded minutes

// a cell's text on one line, a pipe kept from closing the cell
const escapeCell = (text) => controlsReplaced(String(text)).replace(/\|/g, "\\|");

const formatRow = (cells) => `| ${cells.map(escapeCell).join(" | ")} |`;

// parts of a time joined, those of 0 left out: "4 h", "11 min 37 s"
const joinParts = (parts) => parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}`).join(" ");

// seconds as a person reads them: "42 s" under a minute, "11 min 37 s" under an hour, "4 h 28 min" from an hour up,
// rounded to the minute
function describeTime(seconds) {
  const whole = Math.round(seconds);
  if (whole < MINUTE) return `${whole} s`;
  if (whole < HOUR) return joinParts([[Math.floor(whole / MINUTE), "min"], [whole % MINUTE, "s"]]);
  const minutes = Math.round(whole / MINUTE);
  return joinParts([[Math.floor(minutes / MINUTES_IN_HOUR), "h"], [minutes % MINUTES_IN_HOUR, "min"]]);
}

// counts by hook ({ name: count }, a Map), the most first, as "git-alone 2, shell-block 1", or 0
function formatByHook(counts) {
  const sorted = [...counts].sort(([a, m], [b, n]) => n - m || (a < b ? -1 : 1));
  return sorted.length ? sorted.map(([name, n]) => `${cutAt(name, NAME_CAP)} ${n}`).join(", ") : 0;
}

// a green ({ seconds, outcome }, both null with no end) as "3 min 3 s exit 0", or "no end seen"
const describeGreen = (green) => (green.outcome === null ? "no end seen" : `${describeTime(green.seconds)} ${green.outcome}`);

// a run's greens, in the order they were called, as "3 min 3 s exit 0, no end seen", or 0
const describeGreens = (greens) => (greens.length ? greens.map(describeGreen).join(", ") : 0);

// a run's test runs ({ seconds, outcome }, both null with no end) as "12 runs, 39 min 5 s", the time of those ended,
// then ", 1 no end seen" when any has none; or 0
function describeTestRuns(testRuns) {
  if (!testRuns.length) return 0;
  const ended = testRuns.filter((run) => run.outcome !== null);
  const seconds = ended.reduce((sum, run) => sum + run.seconds, 0);
  const noEnd = testRuns.length - ended.length;
  return `${plural(testRuns.length, "run")}, ${describeTime(seconds)}${noEnd ? `, ${noEnd} no end seen` : ""}`;
}

// a slowest test file's line the green printed, its seconds said as a time ("5 min 44 s  tests/x-test.py"); any other
// line as printed
function describeSlowestLine(line) {
  const read = readSlowestFile(line);
  return read ? `${describeTime(read.seconds)}  ${read.file}` : line;
}

// a green's line in the list under the table, its run named and its start, then under it its slowest test files
function formatGreenLines(name, green) {
  const head = `- ${name}, ${new Date(green.started).toISOString()}: ${describeGreen(green)}`;
  if (green.outcome === null) return [head];
  const [said, ...under] = green.slowest.length ? green.slowest : ["no slowest test files printed"];
  return [`${head}; ${describeHeadingAsTime(said)}`, ...under.map((line) => `  - ${describeSlowestLine(line)}`)];
}

// the lines listing the runs' greens, under each its slowest test files, uncut
const listGreenLines = (runs) => runs.flatMap((run) => run.greens.flatMap((green) => formatGreenLines(cutAt(run.name, NAME_CAP), green)));

// the list of greens' lines after a blank line and its heading, each cut to its cap; none when no run has a green
const formatGreensList = (lines) => (lines.length ? ["", GREENS_HEADING, ...lines.map((line) => controlsReplaced(cutAt(line, GREEN_LINE_CAP)))] : []);

// a run's cells: its time split into waiting on the owner, with the waits' count, and the rest
function formatCells(run) {
  const split = run.waits
    ? [`${describeTime(run.waits.waited)} (${plural(run.waits.waits, "wait")})`, describeTime(run.seconds - run.waits.waited)]
    : ["", ""];
  return [cutAt(run.name, NAME_CAP), run.calls, describeTime(run.seconds), ...split, describeGreens(run.greens), describeTestRuns(run.testRuns), formatByHook(run.refused), formatByHook(run.lintFixes), run.exited, run.denied, run.toolErrors, run.repeated];
}

// the list of each run's name and its transcript's path, in the rows' order, after a blank line and its heading
const formatTranscriptsList = (runs) => ["", TRANSCRIPTS_HEADING,
  ...runs.map((run) => controlsReplaced(`- ${cutAt(run.name, NAME_CAP)}: ${run.path}`))];

// the names a table shows over the cap: runs' and hooks'
const countNamesOverCap = (runs) => runs.flatMap((r) => [r.name, ...r.refused.keys(), ...r.lintFixes.keys()])
  .filter((name) => name.length > NAME_CAP).length;

// what the bounds cut and the read skipped ({ linesSkipped, linesUnparsed, transcriptsUnreadable, foldersUnlisted,
// descriptionsUnreadable, transcriptsLeft, linksNotRead, namesCut, printedCut }, beside the caps a line's bytes and the
// transcripts read are held to: { lineBytesCap, transcriptCap }), a line each, or a line saying nothing was
function describeCuts(cuts) {
  const lines = [];
  if (cuts.namesCut) lines.push(`- ${plural(cuts.namesCut, "name")} cut to ${NAME_CAP} characters`);
  if (cuts.printedCut) lines.push(`- ${plural(cuts.printedCut, "printed line")} cut to ${GREEN_LINE_CAP} characters`);
  if (cuts.linesSkipped) lines.push(`- ${plural(cuts.linesSkipped, "line")} over ${cuts.lineBytesCap / MEGABYTE} MB, skipped`);
  if (cuts.linesUnparsed) lines.push(`- ${plural(cuts.linesUnparsed, "line")} that could not be parsed, skipped`);
  if (cuts.transcriptsUnreadable) lines.push(`- ${plural(cuts.transcriptsUnreadable, "transcript")} that could not be read, skipped`);
  if (cuts.foldersUnlisted) lines.push(`- ${plural(cuts.foldersUnlisted, "folder")} that could not be listed`);
  if (cuts.descriptionsUnreadable) lines.push(`- ${plural(cuts.descriptionsUnreadable, "description file")} that could not be read`);
  if (cuts.linksNotRead) lines.push(`- ${plural(cuts.linksNotRead, "link")} in the transcript folder, not read`);
  if (cuts.transcriptsLeft) {
    lines.push(`- ${plural(cuts.transcriptsLeft, "transcript")} over the cap of ${cuts.transcriptCap.toLocaleString("en-US")}, not read`);
  }
  return lines.length ? ["Skipped or shortened while reading:", ...lines] : ["Nothing was skipped or shortened while reading."];
}

// The table for `number`'s retro: its title, its window ({ from, to, said }), a row per run ({ name, calls, seconds,
// path, greens, and its waits: { waited, waits } }), each run's transcript listed, the greens listed with their
// slowest test files, and what the read skipped or shortened.
export function formatRunsTable(number, window, { runs, cuts }) {
  const head = ["Run", "Calls", "Time", "Waiting on you", "The rest", "Greens", "Test runs", "Refused", "Lint fixes", "Exited non-zero", "Denied", "Tool errors", "Repeated failed calls"];
  const listed = listGreenLines(runs);
  return [
    `# Slice runs, #${number}`,
    "",
    `Window: ${new Date(window.from).toISOString()} to ${new Date(window.to).toISOString()}, ${window.said}.`,
    "",
    formatRow(head),
    formatRow(head.map(() => "---")),
    ...runs.map((r) => formatRow(formatCells(r))),
    ...formatTranscriptsList(runs),
    ...formatGreensList(listed),
    "",
    ...describeCuts({ ...cuts, namesCut: countNamesOverCap(runs), printedCut: listed.filter((line) => line.length > GREEN_LINE_CAP).length }),
  ].join("\n");
}
