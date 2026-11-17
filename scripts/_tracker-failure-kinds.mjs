// @level domain
// Roadkeeper — the kinds of a failed tracker read: the tracker names one (scripts/_tracker.mjs, classifyFailure); each
// is said in the same plain words wherever it is said (describeFailure), The Road's page (scripts/road/page/page.mjs)
// among them.

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
});

// What a failed read says, by its kind, a command in backticks; no text of `gh`'s.
const FAILURE_WORDS = new Map([
  [FAILURE_KIND.noAnswer, "GitHub did not answer"],
  [FAILURE_KIND.outOfTime, "the read ran out of time"],
  [FAILURE_KIND.notSignedIn, "gh is not signed in to GitHub: run `gh auth login`"],
  [FAILURE_KIND.ghMissing, "gh is not installed"],
  [FAILURE_KIND.rateLimited, "GitHub is limiting reads for now: it passes within the hour"],
  [FAILURE_KIND.other, "GitHub refused the read"],
  [FAILURE_KIND.incompleteIssues, "GitHub's list of issues came back incomplete"],
  [FAILURE_KIND.incompleteMilestones, "GitHub's list of milestones came back incomplete"],
]);

// The words of a failed read's kind; a kind with no words is a state the tracker never gives, and throws.
export function describeFailure(kind) {
  if (!FAILURE_WORDS.has(kind)) throw new Error(`no words for the failed read's kind: ${kind}`);
  return FAILURE_WORDS.get(kind);
}
