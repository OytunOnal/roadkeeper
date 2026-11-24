// @level domain
// Roadkeeper — one run's hook refusals (GLOSSARY.md) and lint fixes, counted by hook, and its failed calls by kind,
// from its transcript's entries in the slice window as the counts take them (read-entry-facts.mjs's facts): each
// error result is a refusal, an exit non-zero, a denial or a tool error, by the kind its facts carry.

// a new Map from each of `names` to how often it comes
function countEach(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  return counts;
}

// The hooks and failed calls of a run whose `entries` (read-entry-facts.mjs's facts) fall in the window:
// { refused, lintFixes }, each a Map from a hook's name to its count; { exited, denied, toolErrors }, the failed calls
// by kind; and { repeated }, the inputs of calls in the window failing more than once, of any kind.
export function countHooksAndErrors(entries) {
  const refusedBy = []; // each refusal's hook
  const lintedBy = []; // each lint fix's hook
  const kinds = []; // each other failure's kind
  const inputs = new Map(); // each call's id to its input
  const failedInputs = []; // each failure's input, when its call is in the window
  for (const facts of entries) {
    if (facts.lintBy !== null) lintedBy.push(facts.lintBy);
    for (const { id, input } of facts.calls) inputs.set(id, input);
    for (const { failure, refusedBy: hook, id } of facts.results.filter((result) => result.isError)) {
      if (failure === "refused") refusedBy.push(hook);
      else kinds.push(failure);
      if (inputs.has(id)) failedInputs.push(inputs.get(id));
    }
  }
  const failed = countEach(kinds);
  const repeated = [...countEach(failedInputs).values()].filter((n) => n > 1).length;
  return { refused: countEach(refusedBy), lintFixes: countEach(lintedBy), exited: failed.get("exited") || 0, denied: failed.get("denied") || 0,
    toolErrors: failed.get("toolErrors") || 0, repeated };
}
