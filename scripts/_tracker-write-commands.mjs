// @level infrastructure
// Roadkeeper — gh's command lines that write to the tracker, as The Road's redraw reads them (scripts/road-redraw.mjs):
// an issue, a label, a milestone, a pull request that merges or closes.

// A gh call that changes what The Road draws.
const WRITES = [
  /\bgh\s+issue\s+(create|edit|close|reopen|comment|delete|transfer|lock|unlock|pin|unpin)\b/,
  /\bgh\s+label\s+(create|edit|delete|clone)\b/,
  /\bgh\s+pr\s+(merge|close|reopen)\b/,
];
// `gh api` writes when it carries a field, a method or an input, and touches what the page draws.
const API_CALL = /\bgh\s+api\b[^\n;&|]*/g;
const API_TARGET = /\b(milestones|issues|labels)\b/; // the REST paths holding what the page draws
const API_WRITE = /\s(-f|-F|-X|--field|--raw-field|--method|--input)\b/; // gh api's options sending a body or a method

// Whether a shell command holds a gh call writing to what The Road draws.
export function writesTracker(command) {
  const c = String(command || "");
  if (WRITES.some((re) => re.test(c))) return true;
  return (c.match(API_CALL) || []).some((call) => API_TARGET.test(call) && API_WRITE.test(call));
}
