// @level infrastructure
// Roadkeeper — the stack adapters, the project tools' seam: what a commands file's `stack` decides. An adapter says the
// defaults of the install folder by its path from a project's root (null: none), the test-file patterns and how many
// test files one run of `runTests` takes, each the commands file's when it names one, and how a run's cases are read by
// name: `cases({ root, files, output, results })`, the tree the run ran in, its files, its output and the results file
// `{out}` named, gives each case as { file, id, name, outcome, detail }, its outcome PASS, FAIL or SKIP, its id naming it
// in its file, its name as a reader sees it. Both read JUnit (stacks/junit-results.mjs): JS/TS Vitest's and Node's
// runner's (stacks/js-ts.mjs), Python pytest's and Roadkeeper's suites' (stacks/python.mjs). For the check at write, `breaches({ file, output, passed })`, the
// written file's path from the root, its `lintFile` run's output and whether the run exited 0, gives each breach as
// { line, rule, numbers }, `numbers` [found, limit] or null, unused names left out; null when the output cannot be
// read. JS/TS reads ESLint's JSON; Python, the lines `path:line:col: CODE message`.

import { jsTs } from "./stacks/js-ts.mjs";
import { python } from "./stacks/python.mjs";

const ADAPTERS = new Map([["js-ts", jsTs], ["python", python]]); // a stack's name in the commands file, its adapter

// The stacks a commands file may name.
export const STACKS = [...ADAPTERS.keys()];

// The adapter of a stack the commands file named.
export const adapterOf = (stack) => ADAPTERS.get(stack);
