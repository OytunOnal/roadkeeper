// @level infrastructure
// Roadkeeper — the stack adapters, the project tools' seam: what a commands file's `stack` decides. An adapter says the
// defaults of the install folder by its path from a project's root (null: none), the test-file patterns and how many
// test files one run of `runTests` takes, each the commands file's when it names one, and how a run's cases are read by
// name: `cases({ root, files, output, results })`, the tree the run ran in, its files, its output and the results file
// `{out}` named, gives each case as { file, id, name, outcome, detail, text, skipReason }, its outcome PASS, FAIL or
// SKIP, its id naming it in its file, its name as a reader sees it, `text` its failure's text beside the detail,
// `skipReason` a skip's message. Both read JUnit (stacks/junit-results.mjs): JS/TS Vitest's and Node's runner's
// (stacks/js-ts.mjs), Python pytest's and Roadkeeper's suites' (stacks/python.mjs). For the check at write,
// `breaches({ file, output, passed })`, the written file's path from the root, its `lintFile` run's output and whether
// the run exited 0, gives { breaches }, each { line, rule, numbers }, `numbers` [found, limit] or null, unused names
// left out; or { cause }, the name of why no breach is read: `failed`, the run did not pass and its output holds
// nothing the adapter reads (a JS/TS report with no error among them), `unread`, it passed with output the adapter
// cannot read; or a cause ESLint's own sentence names, both stacks reading it (stacks/lint-message.mjs), given beside
// the breaches when there are any: `over-counted`, a suppression record counts more breaches of a rule than the file
// has now, `eslint-stopped`, ESLint stopped on an error of its own before judging the file. JS/TS reads ESLint's JSON;
// Python, the lines `path:line:col: CODE message`.

import { jsTs } from "./stacks/js-ts.mjs";
import { python } from "./stacks/python.mjs";

const ADAPTERS = new Map([["js-ts", jsTs], ["python", python]]); // a stack's name in the commands file, its adapter

// The causes `breaches` names, each by its name above: { failed, unread, overCounted, eslintStopped }.
export { CAUSES } from "./stacks/lint-message.mjs";

// The stacks a commands file may name.
export const STACKS = [...ADAPTERS.keys()];

// The adapter of a stack the commands file named.
export const adapterOf = (stack) => ADAPTERS.get(stack);
