// @level presentation
// Roadkeeper — what a tracker read says to a person: a failed read's kind (scripts/_tracker-failure-kinds.mjs) in the
// same plain words wherever it is said (describeFailure), The Road's page (scripts/road/page/page.mjs) among them; and
// which snapshot a read that is not live read.

import { FAILURE_KIND } from "./_tracker-failure-kinds.mjs";

// What a failed read says, by its kind, each the words for the issue read ({ number, repository }, null when the read
// named none); a command in backticks; no text of `gh`'s. A kind with a step ends with it; the kinds that pass on their
// own (READ_AGAIN_KINDS) name the fault alone, and their caller gives the step. Not found's words name the issue read
// and its repository.
const FAILURE_WORDS = new Map([
  [FAILURE_KIND.notFound, ({ number, repository }) => `issue #${number} is not on ${repository}: check the number`],
  [FAILURE_KIND.noAnswer, () => "GitHub did not answer"],
  [FAILURE_KIND.outOfTime, () => "the read ran out of time"],
  [FAILURE_KIND.notSignedIn, () => "gh is not signed in to GitHub: run `gh auth login`"],
  [FAILURE_KIND.ghMissing, () => "gh is not installed: install it, then run `gh auth login`"],
  [FAILURE_KIND.rateLimited, () => "GitHub is limiting reads for now: it passes within the hour"],
  [FAILURE_KIND.other, () => "GitHub refused the read: run `gh issue list` to read GitHub's own words"],
  [FAILURE_KIND.incompleteIssues, () => "GitHub's list of issues came back incomplete"],
  [FAILURE_KIND.incompleteMilestones, () => "GitHub's list of milestones came back incomplete"],
]);

// the kinds a read made again clears, said with their caller's step
const READ_AGAIN_KINDS = new Set([FAILURE_KIND.noAnswer, FAILURE_KIND.outOfTime, FAILURE_KIND.incompleteIssues,
  FAILURE_KIND.incompleteMilestones]);

// The words of a failed read's kind: a kind that passes on its own ends with `again`, the caller's step for reading
// again; not found's are for `issue` ({ number, repository }, the issue read). A kind with no words, one passing on its
// own with no `again`, or not found with no issue, is a state no caller gives, and throws.
export function describeFailure(kind, { again = null, issue = null } = {}) {
  if (!FAILURE_WORDS.has(kind)) throw new Error(`no words for the failed read's kind: ${kind}`);
  if (kind === FAILURE_KIND.notFound && !issue) throw new Error(`no issue named for the failed read's kind: ${kind}`);
  const words = FAILURE_WORDS.get(kind)(issue);
  if (!READ_AGAIN_KINDS.has(kind)) return words;
  if (!again) throw new Error(`no step given for the failed read's kind: ${kind}`);
  return `${words}: ${again}`;
}

// Which snapshot a read that is not live read, in the words a command prints.
export const snapshotSource = (tracker) => (tracker.fromMainCheckout ? "the main checkout's snapshot" : "the snapshot");
