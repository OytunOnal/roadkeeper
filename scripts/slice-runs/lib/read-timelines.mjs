// @level infrastructure
// Roadkeeper — GitHub's issue timelines and repository events, read for the slice window: the tracker's REST read
// (scripts/_tracker.mjs's openTrackerRead) wrapped so each event comes back as the facts the window's rule takes
// (slice-window.mjs): its time, whether it added the `active` label, the issue it happened to, the closed issue a
// cross-reference comes from, a comment's text, and whether it closed the issue.

const ACTIVE = "active"; // the label marking the slice in progress

// the issue a cross-reference comes from, when it is a closed issue, not a pull request; else null
function readClosedSource(event) {
  const issue = event?.event === "cross-referenced" ? event.source?.issue : null;
  const isClosedIssue = issue?.state === "closed" && !issue.pull_request;
  return isClosedIssue && Number.isInteger(issue.number) ? issue.number : null;
}

// One event of GitHub's as the window's facts: { time, isActiveAdded, issue, closedSource, comment, isClose }, time
// in milliseconds (NaN when unread), issue the number of the issue it happened to or null, comment a comment's text
// or null.
const readEvent = (event) => ({
  time: Date.parse(event?.created_at),
  isActiveAdded: event?.event === "labeled" && event.label?.name === ACTIVE,
  issue: Number.isInteger(event?.issue?.number) ? event.issue.number : null,
  closedSource: readClosedSource(event),
  comment: event?.event === "commented" && typeof event.body === "string" ? event.body : null,
  isClose: event?.event === "closed",
});

const readEvents = (page) => page.map(readEvent);

// The tracker's REST read `tracker` (openTrackerRead's) as the window's reads: `timeline(number, cap)`, an issue's
// timeline as facts, at most `cap` events; `events(cap, isEnough)`, the repository's events as facts, newest first,
// read until `isEnough(page)` of facts says the read ends: { items, capped }.
export function readTimelines(tracker) {
  return {
    timeline: (number, cap) => readEvents(tracker.list(`issues/${number}/timeline`, cap).items),
    events: (cap, isEnough) => {
      const read = tracker.list("issues/events", cap, (page) => isEnough(readEvents(page)));
      return { items: readEvents(read.items), capped: read.capped };
    },
  };
}
