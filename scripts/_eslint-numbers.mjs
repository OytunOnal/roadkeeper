// @level domain
// Roadkeeper — the numbers an ESLint limit rule's message states, read by the js-ts stack's check at write
// (project-tools/adapters/stacks/js-ts.mjs) and by Roadkeeper's check's formatter (tools/lint/check-format.mjs).

// ESLint's limit rules' message end: `has too many lines (41). Maximum allowed is 40.`, `a complexity of 21. Maximum…`
const MAXIMUM = /(\d+)\)?\. Maximum allowed is (\d+)\.$/;

// [found, limit] an ESLint limit rule's message states, or null.
export function eslintNumbers(message) {
  const said = MAXIMUM.exec(typeof message === "string" ? message : "");
  return said ? [Number(said[1]), Number(said[2])] : null;
}
