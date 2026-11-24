// @level application
// Roadkeeper — the kinds of a failed tracker read, the tracker port's outcomes: the tracker names one
// (scripts/_tracker.mjs, classifyFailure); their words are scripts/_tracker-words.mjs's.

// each kind by its name, one string the tracker writes and the page reads
export const FAILURE_KIND = Object.freeze({
  noAnswer: "no-answer",        // a server's error answer, a failed connection, gh's own timeout
  outOfTime: "out-of-time",     // the read stopped waiting: its time spent, or a gh call past the time it was given
  notSignedIn: "not-signed-in", // gh holds no login, or its login was refused
  ghMissing: "gh-missing",      // no gh to run
  rateLimited: "rate-limited",  // GitHub limiting reads, which passes on its own
  other: "other",               // any other failure
  incompleteIssues: "incomplete-issues",         // GitHub's list of issues ended short of an issue `gh issue list` gave
  incompleteMilestones: "incomplete-milestones", // GitHub's list of milestones lacks a milestone an issue names
  notFound: "not-found",        // GitHub's 404 for a read naming one issue (scripts/_tracker.mjs, openTrackerRead)
});

// whether `kind` is one of FAILURE_KIND's
export const isFailureKind = (kind) => Object.values(FAILURE_KIND).includes(kind);
