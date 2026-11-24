// @level domain
// Roadkeeper — one run's calls of a kind of command, from its transcript's entries in the slice window as the counts
// take them (read-entry-facts.mjs's facts): each a shell call whose command a test picks, ended by its own result, or,
// when that result says it went to the background, by the task notification naming its call; its seconds from the
// call to that end, its outcome the exit code. A call a hook refused, or auto mode or the owner denied, never ran, and
// is none.

import { findCallIds, toSeconds } from "./run-counts.mjs";

const NEVER_RUN = new Set(["refused", "denied"]); // the failure kinds of a call stopped before it ran

// the ids of the calls an entry makes whose command `isPicked` says yes to; a call with no id is none
const findPickedCalls = (facts, isPicked) => findCallIds(facts, (call) => call.command !== null && isPicked(call.command));

// each end an entry holds: { id, outcome, printed, outputFile, isBackground, isNeverRun }, a result's, printing its
// text, or a notification's
function findEnds(facts) {
  const results = facts.results.map((result) => ({ id: result.id, outcome: result.outcome, printed: result.text, outputFile: null,
    isBackground: result.isBackground, isNeverRun: result.isError && NEVER_RUN.has(result.failure) }));
  return facts.notified ? [...results, { ...facts.notified, printed: null, isBackground: false }] : results;
}

// The calls of a run whose `entries` (read-entry-facts.mjs's facts, in the file's order) fall in the window and whose
// command `isPicked` says yes to, in the order they were called: each { started, seconds, outcome, printed,
// outputFile }, seconds and outcome null when no end is seen, printed its result's text, null for a notification's end
// or none, outputFile the file its notification names, else null.
export function findCommandRuns(entries, isPicked) {
  const runs = new Map(); // each call's id to its run
  for (const facts of entries) {
    const time = facts.time;
    for (const id of findPickedCalls(facts, isPicked)) runs.set(id, { started: time, seconds: null, outcome: null, printed: null, outputFile: null });
    for (const end of findEnds(facts)) {
      const run = runs.get(end.id);
      const isOpen = run && run.outcome === null;
      if (!isOpen || end.isBackground) continue;
      if (end.isNeverRun) { runs.delete(end.id); continue; }
      run.seconds = toSeconds(time - run.started);
      run.outcome = end.outcome;
      run.printed = end.printed;
      run.outputFile = end.outputFile;
    }
  }
  return [...runs.values()];
}
