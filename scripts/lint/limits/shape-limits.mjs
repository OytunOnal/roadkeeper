// @level domain
// Roadkeeper's shape limits: a function's lines, parameters and nesting, no nested ternaries, no unused names, a
// condition of more than two clauses named, a top-level UPPER_CASE constant given its reason in a comment, and a file's
// lines. The lint entry (scripts/lint/lint.mjs) teaches them to ESLint.

export const FILE_LINES = 400; // a file an agent can read whole in one call

// the limits on functions, names and constants, the file's length aside
export const SHAPE_RULES = {
  "max-lines-per-function": ["error", { max: 40 }],
  "max-params": ["error", { max: 3 }],
  "max-depth": ["error", { max: 3 }],
  "no-nested-ternary": "error",
  "no-unused-vars": "error",
  "roadkeeper/named-condition": "error",
  "roadkeeper/constant-reason": "error",
};
