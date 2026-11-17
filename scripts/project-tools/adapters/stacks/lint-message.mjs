// @level domain
// Roadkeeper — what the adapters read from a linter's output for the check at write: whether a finding's rule is an
// unused-name rule, left to the commit; and ESLint's own sentences, which both stacks read, Roadkeeper's check passing
// ESLint's lines through: its unused-suppressions sentence (eslint/lib/cli.js) and its fatal line (eslint/bin/eslint.js),
// each read only as a line of its own, never inside a report's line; and the read both adapters give back from what they
// found. The numbers ESLint's limit rules state are ../../../_eslint-numbers.mjs's.

// an unused-name rule's name, after any plugin's prefix: a name is often written one edit before its first use. ESLint's
// own and its plugins'; pyflakes' codes, as ruff and flake8 print them; pylint's
const UNUSED_NAMES = new Set(["no-unused-vars", "no-unused-imports", "no-unused-private-class-members", "F401", "F841",
  "W0611", "W0612"]);

// Whether a rule id names an unused-name rule, ESLint's own or a plugin's (`@typescript-eslint/no-unused-vars`).
export const isUnusedName = (rule) => typeof rule === "string" && UNUSED_NAMES.has(rule.split("/").pop());

// the causes an adapter names in place of its breaches or beside them, each a line of the check at write's refusal
export const CAUSES = Object.freeze({ failed: "failed", unread: "unread", overCounted: "over-counted",
  eslintStopped: "eslint-stopped" });

// ESLint's sentences, each the start of a line, and the cause each names, the first found read: ESLint stopped on an
// error of its own (its config, a plugin, a file the config imports) before judging the file; a suppression record
// counting more breaches of a rule than the file has now
const ESLINT_SENTENCES = [
  [/^Oops! Something went wrong!/, CAUSES.eslintStopped],
  [/^There are suppressions left that do not occur anymore\./, CAUSES.overCounted],
];

// The cause ESLint's own sentence in a lint run's output names; null when it holds neither.
export function readEslintCause(output) {
  const lines = output.split(/\r\n?|\n/);
  return ESLINT_SENTENCES.find(([sentence]) => lines.some((l) => sentence.test(l)))?.[1] ?? null;
}

// A lint run's read from what its adapter found: `breaches`, kept of `found` findings (unused names among them), and
// `cause`, ESLint's own sentence's or null. { breaches } with the cause beside them, the cause alone when there is no
// breach; with no cause, { cause: "failed" } when the run did not pass and nothing was found.
export function buildLintRead({ breaches, cause, found, passed }) {
  if (cause) return breaches.length ? { breaches, cause } : { cause };
  return !passed && !found ? { cause: CAUSES.failed } : { breaches };
}
