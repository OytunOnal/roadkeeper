// @level domain
// Roadkeeper — the slice window from the tracker's events: from the slice's `active` label to when the slice gives it
// up or the next issue's, whichever is first. Each event comes as its facts (read-timelines.mjs's): { time,
// isActiveAdded, isActiveRemoved, issue, closedSource, comment, isClose }.

// The closed issues an issue's timeline `events` says reference it, the spec `spec` itself left out: by number.
export function findClosedReferences(events, spec) {
  return [...new Set(events.map((e) => e.closedSource).filter((n) => n !== null && n !== spec))];
}

// The specs an issue's timeline `events` says it was closed specced in, by number, in its comments' order: each
// comment "specced in #<N>", when the issue was closed; none when it was not.
function listSpecsNamed(events) {
  if (!events.some((e) => e.isClose)) return [];
  return events.map((e) => /\bspecced in #(\d{1,9})\b/i.exec(e.comment ?? "")).filter(Boolean).map((said) => Number(said[1]));
}

// Whether an issue's timeline `events` says it was closed specced in `spec`.
export const isSpeccedIn = (events, spec) => listSpecsNamed(events).includes(spec);

// The spec an issue's timeline `events` first says it was closed specced in, by its number, or null when none.
export const findSpecOf = (events) => listSpecsNamed(events)[0] ?? null;

// The time the slice's issues, each with its own timeline, gave up `active`, in milliseconds: the latest of their last
// `active` events, when each took it off; null while one still holds it, or when none was ever taken off. A slice that
// takes it back after giving it up is counted to its last give-up.
export function findActiveGivenUp(...timelines) {
  const lasts = timelines.map((events) => events.filter((e) => (e.isActiveAdded || e.isActiveRemoved) && Number.isFinite(e.time))
    .sort((a, b) => a.time - b.time).at(-1)).filter(Boolean);
  if (!lasts.length || lasts.some((e) => e.isActiveAdded)) return null;
  return Math.max(...lasts.map((e) => e.time));
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
