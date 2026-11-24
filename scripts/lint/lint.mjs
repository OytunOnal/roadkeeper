// @level infrastructure
// Roadkeeper — its lint rules for ESLint: the preset and the plugin `roadkeeper` (named-condition, constant-reason,
// ceiling-paid-off, inner-levels-pure). Imports nothing but its own rules and limits (limits/shape-limits.mjs), so a
// project loads its copy (roadkeeper-lint/ at its root, written by the plugin's scripts/copy-lint-rules.mjs) with no
// plugin installed; Roadkeeper's own config loads this source.
//
// The preset: SHAPE_RULES (a function's lines, parameters and nesting, no nested ternaries, no unused names, a
// condition of more than two clauses named, a top-level UPPER_CASE constant given its reason in a comment), a file's
// lines, FILE_LINES, and roadkeeper/inner-levels-pure: a file tagged kernel, domain or application reaches no disk,
// clock, network or process. The project's config hands in its Ceilings, docs/roadkeeper/ceilings.json's rows
// (`{ "<file>": { "lines": 2342 } }`, paths from the config's folder), each its file's own line limit; a file within
// FILE_LINES keeps no Ceiling. Existing breaches go in ESLint's own bulk suppressions record.
//
//   import { readFileSync } from "node:fs";
//   import { preset } from "./roadkeeper-lint/lint.mjs";
//   const ceilings = JSON.parse(readFileSync("docs/roadkeeper/ceilings.json", "utf8"));
//   export default [...preset({ ceilings, files: ["src/**/*.ts"] })];

import { ceilingPaidOff } from "./rules/ceiling-paid-off.mjs";
import { constantReason } from "./rules/constant-reason.mjs";
import { innerLevelsPure } from "./rules/inner-levels-pure.mjs";
import { namedCondition } from "./rules/named-condition.mjs";
import { FILE_LINES, SHAPE_RULES } from "./limits/shape-limits.mjs";

export { FILE_LINES, SHAPE_RULES };

// ESLint's plugin object: register it as `roadkeeper`, its rules then named `roadkeeper/<rule>`
export const plugin = { rules: { "named-condition": namedCondition, "constant-reason": constantReason,
  "ceiling-paid-off": ceilingPaidOff, "inner-levels-pure": innerLevelsPure } };

const isCeiling = (row) => row !== null && typeof row === "object" && Number.isInteger(row.lines) && row.lines >= 0;

// One config object per Ceiling: its file's line limit, and the rule refusing it once within the file limit.
function ceilingConfigs(ceilings) {
  return Object.entries(ceilings).map(([file, row]) => {
    if (!isCeiling(row)) throw new TypeError(`a Ceiling's row is not { "lines": <a whole number> }: ${file}`);
    const rules = { "max-lines": ["error", { max: row.lines }], "roadkeeper/ceiling-paid-off": ["error", { limit: FILE_LINES }] };
    return { files: [file], plugins: { roadkeeper: plugin }, rules };
  });
}

// The preset as ESLint's flat config objects: the shape and the inner levels' purity for the files `files` matches
// (every file ESLint lints when none), then one object per Ceiling.
export function preset({ ceilings = {}, files } = {}) {
  const rules = { ...SHAPE_RULES, "max-lines": ["error", { max: FILE_LINES }], "roadkeeper/inner-levels-pure": "error" };
  const shape = { plugins: { roadkeeper: plugin }, rules };
  return [files ? { files, ...shape } : shape, ...ceilingConfigs(ceilings)];
}
