// @level infrastructure
// Roadkeeper — GitHub's issue timelines and repository events, read for the slice window: the tracker's REST read
// (scripts/_tracker.mjs's openTrackerRead) wrapped so each event comes back as the facts the window's rule takes
// (slice-window.mjs): its time, whether it added or took off the `active` label, the issue it happened to, the closed
// issue a cross-reference comes from, a trusted author's comment's text, and whether it closed the issue.

const ACTIVE = "active"; // the label marking the slice in progress
// the authors whose comment is read: anyone may comment on a public issue, only these may close one as specced
const TRUSTED_AUTHORS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

// a comment's text when the repository's owner, a member or a collaborator wrote it; else null
function readTrustedComment(event) {
  const isComment = event?.event === "commented" && typeof event.body === "string";
  return isComment && TRUSTED_AUTHORS.has(event.author_association) ? event.body : null;
}

// the issue a cross-reference comes from, when it is a closed issue, not a pull request; else null
function readClosedSource(event) {
  const issue = event?.event === "cross-referenced" ? event.source?.issue : null;
  const isClosedIssue = issue?.state === "closed" && !issue.pull_request;
  return isClosedIssue && Number.isInteger(issue.number) ? issue.number : null;
}

// One event of GitHub's as the window's facts: { time, isActiveAdded, isActiveRemoved, issue, closedSource, comment,
// isClose }, time in milliseconds (NaN when unread), issue the number of the issue it happened to or null, comment the
// text of a comment by the repository's owner, a member or a collaborator, or null.
const readEvent = (event) => ({
  time: Date.parse(event?.created_at),
  isActiveAdded: event?.event === "labeled" && event.label?.name === ACTIVE,
  isActiveRemoved: event?.event === "unlabeled" && event.label?.name === ACTIVE,
  issue: Number.isInteger(event?.issue?.number) ? event.issue.number : null,
  closedSource: readClosedSource(event),
  comment: readTrustedComment(event),
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
