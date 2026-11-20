// @level domain
// Roadkeeper — the slice window from the tracker's events: from the slice's `active` label to the next issue's.

const ACTIVE = "active"; // the label marking the slice in progress

const readTime = (event) => Date.parse(event?.created_at);
const isActiveAdded = (event) => event?.event === "labeled" && event.label?.name === ACTIVE;
const readIssueNumber = (event) => (Number.isInteger(event?.issue?.number) ? event.issue.number : null);

// the issue a cross-reference comes from, when it is a closed issue, not a pull request; else null
function readClosedSource(event) {
  const issue = event?.event === "cross-referenced" ? event.source?.issue : null;
  const isClosedIssue = issue?.state === "closed" && !issue.pull_request;
  return isClosedIssue && Number.isInteger(issue.number) ? issue.number : null;
}

// The closed issues an issue's timeline `events` says reference it, the spec `spec` itself left out: by number.
export function findClosedReferences(events, spec) {
  return [...new Set(events.map(readClosedSource).filter((n) => n !== null && n !== spec))];
}

// Whether an issue's timeline `events` says it was closed specced in `spec`: a comment "specced in #<spec>" and a close.
export function isSpeccedIn(events, spec) {
  const said = new RegExp(`\\bspecced in #${spec}\\b`, "i");
  const hasComment = events.some((e) => e?.event === "commented" && typeof e.body === "string" && said.test(e.body));
  return hasComment && events.some((e) => e?.event === "closed");
}

// The first time `active` was added on any of the timelines, in milliseconds, or null when it never was.
export function findFirstActive(...timelines) {
  const times = timelines.flat().filter(isActiveAdded).map(readTime).filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}

// Whether a page of the repository's events, newest first, reaches back before `start`.
export const reachesBefore = (page, start) => page.some((e) => readTime(e) < start);

// The first `active` added after `start` to an issue not of the slice (`sliceIssues`, by number), from the
// repository's events: { time, issue }, or null when none is.
export function findNextActive(events, start, sliceIssues) {
  const next = events
    .filter((e) => isActiveAdded(e) && readTime(e) > start && !sliceIssues.includes(readIssueNumber(e)))
    .sort((a, b) => readTime(a) - readTime(b))[0];
  return next ? { time: readTime(next), issue: readIssueNumber(next) } : null;
}
