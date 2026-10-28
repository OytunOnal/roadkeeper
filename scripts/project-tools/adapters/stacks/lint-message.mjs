// @level domain
// Roadkeeper — what the adapters read from a linter's finding for the check at write: whether its rule is an unused-name
// rule, left to the commit. The numbers ESLint's limit rules state are ../../../_eslint-numbers.mjs's.

// an unused-name rule's name, after any plugin's prefix: a name is often written one edit before its first use. ESLint's
// own and its plugins'; pyflakes' codes, as ruff and flake8 print them; pylint's
const UNUSED_NAMES = new Set(["no-unused-vars", "no-unused-imports", "no-unused-private-class-members", "F401", "F841",
  "W0611", "W0612"]);

// Whether a rule id names an unused-name rule, ESLint's own or a plugin's (`@typescript-eslint/no-unused-vars`).
export const isUnusedName = (rule) => typeof rule === "string" && UNUSED_NAMES.has(rule.split("/").pop());
