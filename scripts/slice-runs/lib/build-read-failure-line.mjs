// @level presentation
// Roadkeeper — what a failed read of the slice window from the tracker stops the retro's count with.

import { FAILURE_KIND, isFailureKind } from "../../_tracker-failure-kinds.mjs";
import { describeFailure } from "../../_tracker-words.mjs";

const RUN_AGAIN = "run it again in a few minutes"; // the step for a failed read that passes on its own

// What a failed tracker read `error` stops the command with: an error carrying a tracker failure kind in the shared
// failure words (describeFailure), an issue not found said as itself, any other kind as the tracker not read; any other
// error, a fault of the window's own code, by its own message.
export function buildReadFailureLine(error) {
  if (!isFailureKind(error?.kind)) return `the tracker could not be read (${error?.message ?? String(error)})`;
  const words = describeFailure(error.kind, { again: RUN_AGAIN, issue: error.issue });
  return error.kind === FAILURE_KIND.notFound ? words : `the tracker could not be read (${words})`;
}
