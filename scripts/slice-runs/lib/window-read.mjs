// @level infrastructure
// Roadkeeper — the slice window of a spec, read from the tracker through scripts/_tracker.mjs and its `gh` rule: it
// starts at the earlier `active` label of the spec and of the issue closed "specced in #<spec>", and ends at the first
// `active` added to any other issue after that, or now.

import { openTrackerRead } from "../../_tracker.mjs";
import { findClosedReferences, findFirstActive, isSpeccedIn, findNextActive, reachesBefore } from "./slice-window.mjs";

const BUDGET = 120000; // milliseconds the tracker's reads may take in all
const MAX_TIMELINE = 1000; // events of one issue's timeline read, ten pages
const MAX_REFERENCES = 20; // closed issues referencing the spec read for the one specced in it
const MAX_EVENTS = 10000; // the repository's events read back to the window's start, a hundred pages

// The issue specced in `spec`, among the closed issues its timeline says reference it: { number, events }, or null.
function findSpeccedFrom(tracker, spec, specEvents) {
  for (const number of findClosedReferences(specEvents, spec).slice(0, MAX_REFERENCES)) {
    const events = tracker.list(`issues/${number}/timeline`, MAX_TIMELINE).items;
    if (isSpeccedIn(events, spec)) return { number, events };
  }
  return null;
}

// The window's end after `start`: the next issue's `active` label, or `now`. { end, said } or { refused }.
function readWindowEnd(tracker, { start, sliceIssues, now }) {
  const read = tracker.list("issues/events", MAX_EVENTS, (page) => reachesBefore(page, start));
  if (read.capped) return { refused: `the tracker's last ${MAX_EVENTS} events do not reach back to the window's start; give the times by hand` };
  const next = findNextActive(read.items, start, sliceIssues);
  return next ? { end: next.time, said: `to #${next.issue}'s active label` } : { end: now, said: "to now" };
}

// The slice window of `spec` at `root`'s tracker, ending at `now` when no other issue is labelled after it:
// { window: { from, to, said } } or { refused }.
export function readSliceWindow(root, spec, now) {
  try {
    const tracker = openTrackerRead(root, BUDGET);
    const specEvents = tracker.list(`issues/${spec}/timeline`, MAX_TIMELINE).items;
    const slice = findSpeccedFrom(tracker, spec, specEvents);
    const start = findFirstActive(specEvents, slice ? slice.events : []);
    const sliceIssues = slice ? [slice.number, spec] : [spec];
    const named = sliceIssues.map((n) => `#${n}`).join(" or ");
    if (start === null) return { refused: `no active label was ever added to ${named}` };
    const end = readWindowEnd(tracker, { start, sliceIssues, now });
    if (end.refused) return end;
    return { window: { from: start, to: end.end, said: `from the first active label of ${named} ${end.said}` } };
  } catch (e) {
    return { refused: `the tracker could not be read (${e.message})` };
  }
}
