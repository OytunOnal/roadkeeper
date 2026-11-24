// @level main
// Roadkeeper — the retro's table of a slice's runs: the transcripts Claude Code keeps for the project, cut to the
// slice window, one row a run holding a message or a call in it.

import { openTrackerRead } from "../_tracker.mjs";
import { readSlowestInOutputFile } from "./lib/green-output.mjs";
import { findGreens } from "./lib/green-runs.mjs";
import { countHooksAndErrors } from "./lib/hook-and-error-counts.mjs";
import { countAgentWaits, countRun, countWaits } from "./lib/run-counts.mjs";
import { formatRunsTable } from "./lib/runs-table.mjs";
import { findTestRuns } from "./lib/test-runs.mjs";
import { readTimelines } from "./lib/read-timelines.mjs";
import { readEntryFacts } from "./lib/read-entry-facts.mjs";
import { findTranscriptFolder, listTranscripts, nameRun, readLastWritten } from "./lib/transcript-folder.mjs";
import { buildReadFailureLine } from "./lib/build-read-failure-line.mjs";
import { LINE_BYTES_CAP, readEntriesIn } from "./lib/transcript-lines.mjs";
import { readSliceWindowFrom } from "./lib/window-read.mjs";

// The slice window of `spec` at `root`'s tracker, ending at `now` when no other issue is labelled after it:
// { window: { from, to, said } } or { refused }, a failed read said as a refusal.
export function readSliceWindow(root, spec, now) {
  try {
    return readSliceWindowFrom((budget) => readTimelines(openTrackerRead(root, budget)), spec, now);
  } catch (e) {
    return { refused: buildReadFailureLine(e) };
  }
}

const MAX_TRANSCRIPTS = 5000; // transcripts read: Roadkeeper's own folder held 2,087 on 2026-11-19

// The transcripts in `folder` to read for `window`, the most recently written first, the count left over the cap, the
// count of links not read, of transcripts whose date cannot be read and of folders not listed; { refused } when the
// folder itself cannot be listed. A transcript last written before the window starts holds nothing in it, and is never
// opened.
function pickTranscriptsToRead(folder, window) {
  const { transcripts, links, unlisted, refused } = listTranscripts(folder);
  if (refused) return { refused };
  const dated = transcripts.map((t) => ({ ...t, written: readLastWritten(t.path) }));
  const written = dated.filter((t) => t.written !== null && t.written >= window.from).sort((a, b) => b.written - a.written);
  const undated = dated.filter((t) => t.written === null).length;
  return { transcripts: written.slice(0, MAX_TRANSCRIPTS), left: Math.max(0, written.length - MAX_TRANSCRIPTS), links, undated,
    unlisted };
}

// a run's greens, a background green's slowest test files read from the output file its notification names
const readGreens = (entries) => findGreens(entries)
  .map((green) => (green.outputFile === null ? green : { ...green, slowest: readSlowestInOutputFile(green.outputFile) }));

// a transcript's row, or null when its window holds no message or call: its counts, its waits, its test runs by
// `testCommand` (test-runs.mjs's), and whether its description file could not be read; its entries read as the counts
// take them (read-entry-facts.mjs)
function buildRun(transcript, timedEntries, testCommand) {
  const entries = readEntryFacts(timedEntries);
  if (!entries.some((facts) => facts.isMessageOrCall)) return null;
  const waits = transcript.isSession ? countWaits(entries) : countAgentWaits(entries);
  const { name, isUnreadable } = nameRun(transcript);
  return { name, path: transcript.path, ...countRun(entries), ...countHooksAndErrors(entries), greens: readGreens(entries), waits,
    testRuns: findTestRuns(entries, testCommand), isSession: transcript.isSession, started: entries[0].time,
    isDescriptionUnreadable: isUnreadable };
}

// rows by start: each session first, then each agent in the order it began
const compareByStart = (a, b) => Number(b.isSession) - Number(a.isSession) || a.started - b.started;

// The table of retro `number`'s runs in `window` ({ from, to, said }), from the project at `root`'s transcripts, its
// config folder read from `env`, its test runs picked by `testCommand` (test-runs.mjs's): { table }, or { refused }
// saying why there is none.
export function buildSliceRunsTable(root, { number, window, testCommand }, env) {
  const { folder, refused } = findTranscriptFolder(root, env);
  if (refused) return { refused };
  const picked = pickTranscriptsToRead(folder, window);
  if (picked.refused) return { refused: picked.refused };
  const { transcripts, left, links, undated, unlisted } = picked;
  const runs = [];
  const cuts = { linesSkipped: 0, linesUnparsed: 0, transcriptsUnreadable: undated, foldersUnlisted: unlisted, transcriptsLeft: left,
    linksNotRead: links, lineBytesCap: LINE_BYTES_CAP, transcriptCap: MAX_TRANSCRIPTS };
  for (const transcript of transcripts) {
    const { entries, skipped, unparsed, isUnreadable } = readEntriesIn(transcript.path, window);
    cuts.linesSkipped += skipped;
    cuts.linesUnparsed += unparsed;
    cuts.transcriptsUnreadable += Number(isUnreadable);
    runs.push(buildRun(transcript, entries, testCommand));
  }
  const kept = runs.filter(Boolean).sort(compareByStart);
  if (!kept.length) return { refused: `the window holds no message or call in the transcripts at ${folder}` };
  cuts.descriptionsUnreadable = kept.filter((run) => run.isDescriptionUnreadable).length;
  return { table: formatRunsTable(number, window, { runs: kept, cuts }) };
}
