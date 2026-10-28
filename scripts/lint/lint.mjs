// @level domain
// Roadkeeper — its lint rules for ESLint: the shape preset and the plugin `roadkeeper` (named-condition, constant-reason,
// ceiling-paid-off). Imports nothing but its own rules, so a project loads its copy (roadkeeper-lint/ at its root, written by
// the plugin's scripts/copy-lint-rules.mjs) with no plugin installed; Roadkeeper's own config loads this source.
//
// The preset: SHAPE_RULES (a function's lines, parameters and nesting, no nested ternaries, no unused names, a
// condition of more than two clauses named, a top-level UPPER_CASE constant given its reason in a comment) and a file's
// lines, FILE_LINES. The project's config hands in its Ceilings, docs/roadkeeper/ceilings.json's rows
// (`{ "<file>": { "lines": 2342 } }`, paths from the config's folder), each its file's own line limit; a file within
// FILE_LINES keeps no Ceiling. Existing function breaches go in ESLint's own bulk suppressions record.
//
//   import { readFileSync } from "node:fs";
//   import { preset } from "./roadkeeper-lint/lint.mjs";
//   const ceilings = JSON.parse(readFileSync("docs/roadkeeper/ceilings.json", "utf8"));
//   export default [...preset({ ceilings, files: ["src/**/*.ts"] })];

import { ceilingPaidOff } from "./rules/ceiling-paid-off.mjs";
import { constantReason } from "./rules/constant-reason.mjs";
import { namedCondition } from "./rules/named-condition.mjs";

export const FILE_LINES = 400; // a file an agent can read whole in one call

// ESLint's plugin object: register it as `roadkeeper`, its rules then named `roadkeeper/<rule>`
export const plugin = { rules: { "named-condition": namedCondition, "constant-reason": constantReason,
  "ceiling-paid-off": ceilingPaidOff } };

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

const isCeiling = (row) => row !== null && typeof row === "object" && Number.isInteger(row.lines) && row.lines >= 0;

// One config object per Ceiling: its file's line limit, and the rule refusing it once within the file limit.
function ceilingConfigs(ceilings) {
  return Object.entries(ceilings).map(([file, row]) => {
    if (!isCeiling(row)) throw new TypeError(`a Ceiling's row is not { "lines": <a whole number> }: ${file}`);
    const rules = { "max-lines": ["error", { max: row.lines }], "roadkeeper/ceiling-paid-off": ["error", { limit: FILE_LINES }] };
    return { files: [file], plugins: { roadkeeper: plugin }, rules };
  });
}

// The preset as ESLint's flat config objects: the shape for the files `files` matches (every file ESLint lints when
// none), then one object per Ceiling.
export function preset({ ceilings = {}, files } = {}) {
  const shape = { plugins: { roadkeeper: plugin }, rules: { ...SHAPE_RULES, "max-lines": ["error", { max: FILE_LINES }] } };
  return [files ? { files, ...shape } : shape, ...ceilingConfigs(ceilings)];
}
