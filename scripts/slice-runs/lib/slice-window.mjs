// @level domain
// Roadkeeper — the slice window from the tracker's events: from the slice's `active` label to the next issue's. Each
// event comes as its facts (read-timelines.mjs's): { time, isActiveAdded, issue, closedSource, comment, isClose }.

// The closed issues an issue's timeline `events` says reference it, the spec `spec` itself left out: by number.
export function findClosedReferences(events, spec) {
  return [...new Set(events.map((e) => e.closedSource).filter((n) => n !== null && n !== spec))];
}

// Whether an issue's timeline `events` says it was closed specced in `spec`: a comment "specced in #<spec>" and a close.
export function isSpeccedIn(events, spec) {
  const said = new RegExp(`\\bspecced in #${spec}\\b`, "i");
  const hasComment = events.some((e) => e.comment !== null && said.test(e.comment));
  return hasComment && events.some((e) => e.isClose);
}

// The first time `active` was added on any of the timelines, in milliseconds, or null when it never was.
export function findFirstActive(...timelines) {
  const times = timelines.flat().filter((e) => e.isActiveAdded).map((e) => e.time).filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}

// Whether a page of the repository's events, newest first, reaches back before `start`.
export const reachesBefore = (page, start) => page.some((e) => e.time < start);

// The first `active` added after `start` to an issue not of the slice (`sliceIssues`, by number), from the
// repository's events: { time, issue }, or null when none is.
export function findNextActive(events, start, sliceIssues) {
  const next = events
    .filter((e) => e.isActiveAdded && e.time > start && !sliceIssues.includes(e.issue))
    .sort((a, b) => a.time - b.time)[0];
  return next ? { time: next.time, issue: next.issue } : null;
}
