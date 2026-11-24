// @level infrastructure
// Roadkeeper — one run's test runs from its transcript's entries in the slice window: each a call whose shell command
// line runs the
// project's tests, ended as command-runs.mjs ends a call. A command runs them when one of its steps runs
// reader-tests.mjs with --run, red-before.mjs or same-cases.mjs, or runs a test file by name with the program the
// project's commands file runs its tests with.

import { findCommandRuns } from "./command-runs.mjs";

const STEPS = /&&|\|\||[;|()]/; // what parts a command into steps: a chain's `&&`, `||`, `;`, `|`, and a subshell's brackets
const NODE = /^node(?:\.exe)?$/; // the program running a tool's script
const TOOLS = new Set(["red-before.mjs", "same-cases.mjs"]); // the tools that run tests whenever they run
const READER_TESTS = "reader-tests.mjs"; // the tool that runs tests only with --run
const RUN = "--run"; // reader-tests' option to run the tests it lists

// a path's last segment, by either slash, without the quotes around it
const lastSegment = (word) => word.replace(/^["']|["']$/g, "").split(/[\\/]/).pop();

// a word as a path from the project's root: quotes taken off, `\` as `/`, a leading `./` dropped
const asPath = (word) => word.replace(/^["']|["']$/g, "").replace(/\\/g, "/").replace(/^\.\//, "");

// whether a step's words run a tool that runs tests
function runsTestTool(words) {
  const script = words.length > 1 && NODE.test(lastSegment(words[0])) ? lastSegment(words[1]) : "";
  return TOOLS.has(script) || (script === READER_TESTS && words.includes(RUN));
}

// whether a step's words run a test file by name: the program first, then, past its options, a test file
function runsTestFile(words, { program, isTestFile }) {
  const isProgram = program !== null && words.length > 1 && lastSegment(words[0]).replace(/\.exe$/, "") === program;
  const named = words.slice(1).find((word) => !word.startsWith("-"));
  return isProgram && named !== undefined && isTestFile(asPath(named));
}

// Whether `command` runs the project's tests, `testCommand` ({ program, isTestFile }) the program its commands file
// runs its tests with, null for none, and whether a path from the root is one of its test files.
export function runsTests(command, testCommand) {
  return command.split(STEPS).map((step) => step.trim().split(/\s+/).filter(Boolean))
    .some((words) => runsTestTool(words) || runsTestFile(words, testCommand));
}

// The test runs of a run whose `entries` (read-entry-facts.mjs's facts, in the file's order) fall in the window, in the order they
// were called: each { started, seconds, outcome }, seconds and outcome null when no end is seen.
export const findTestRuns = (entries, testCommand) => findCommandRuns(entries, (command) => runsTests(command, testCommand))
  .map(({ started, seconds, outcome }) => ({ started, seconds, outcome }));
