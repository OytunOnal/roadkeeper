// @level application
// Roadkeeper — the slice window of a spec, read from the tracker its caller opens: it starts at the earlier `active`
// label of the spec and of the issue closed "specced in #<spec>", and ends at the first `active` added to any other
// issue after that, or now. A failed tracker read is thrown to the caller.

import { findClosedReferences, findFirstActive, isSpeccedIn, findNextActive, reachesBefore } from "./slice-window.mjs";

const BUDGET = 120000; // milliseconds the tracker's reads may take in all
const MAX_TIMELINE = 1000; // events of one issue's timeline read, ten pages
const MAX_REFERENCES = 20; // closed issues referencing the spec read for the one specced in it
const MAX_EVENTS = 10000; // the repository's events read back to the window's start, a hundred pages

// The issue specced in `spec`, among the closed issues its timeline says reference it: { number, events }, or null.
function findSpeccedFrom(tracker, spec, specEvents) {
  for (const number of findClosedReferences(specEvents, spec).slice(0, MAX_REFERENCES)) {
    const events = tracker.timeline(number, MAX_TIMELINE);
    if (isSpeccedIn(events, spec)) return { number, events };
  }
  return null;
}

// The window's end after `start`: the next issue's `active` label, or `now`. { end, said } or { refused }.
function readWindowEnd(tracker, { start, sliceIssues, now }) {
  const read = tracker.events(MAX_EVENTS, (page) => reachesBefore(page, start));
  if (read.capped) return { refused: `the tracker's last ${MAX_EVENTS} events do not reach back to the window's start; give the times by hand` };
  const next = findNextActive(read.items, start, sliceIssues);
  return next ? { end: next.time, said: `to #${next.issue}'s active label` } : { end: now, said: "to now" };
}

// The slice window of `spec` in the tracker `openTracker(budget)` opens for reads taking `budget` milliseconds in all,
// ending at `now` when no other issue is labelled after it: { window: { from, to, said } } or { refused }; a failed read
// throws. The tracker it opens reads `timeline(number, cap)`, an issue's timeline, and `events(cap, isEnough)`, the
// repository's events, newest first, { items, capped }, each event as slice-window.mjs's facts.
export function readSliceWindowFrom(openTracker, spec, now) {
  const tracker = openTracker(BUDGET);
  const specEvents = tracker.timeline(spec, MAX_TIMELINE);
  const slice = findSpeccedFrom(tracker, spec, specEvents);
  const start = findFirstActive(specEvents, slice ? slice.events : []);
  const sliceIssues = slice ? [slice.number, spec] : [spec];
  const named = sliceIssues.map((n) => `#${n}`).join(" or ");
  if (start === null) return { refused: `no active label was ever added to ${named}` };
  const end = readWindowEnd(tracker, { start, sliceIssues, now });
  if (end.refused) return end;
  return { window: { from: start, to: end.end, said: `from the first active label of ${named} ${end.said}` } };
}
