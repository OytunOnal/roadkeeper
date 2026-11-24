// @level domain
// Roadkeeper — a project's commands file's fields and what each must be: the first field a parsed file breaks, as a
// fixed line naming the file (a field of the wrong shape, a required one missing, `docTests` with no `runTests` to run
// them), and the known fields kept, `readByNothing` defaulted; and the `green` step that runs the project's tests.
// Fields it does not know are left alone. The stacks a `stack` may name are the caller's.

import { isPathFromRoot } from "./json-shapes.mjs";

export const COMMANDS_FILE = "docs/roadkeeper/commands.json"; // every tool's one place for the project's commands
const MAX_COMMANDS = 100;       // commands in one list: a green of a handful of steps, with room
const MAX_ARGUMENTS = 1000;     // arguments in one command: a long list of named test files
const MAX_PATH = 260;           // characters of the install's path: Windows' classic path length
const MAX_RECORDS = 20;         // suppression records listed: one per linter or language, with room
const DEFAULT_READ_BY_NOTHING = ["docs/roadkeeper/**"]; // Roadkeeper's docs folder: what the green never reads
const TESTS_STEP = "{tests}"; // the step, an argument of its own, that runs the project's tests

const own = (o, k) => Object.hasOwn(o, k);
const isString = (s) => typeof s === "string";
const isCommand = (c) => Array.isArray(c) && c.length > 0 && c.length <= MAX_ARGUMENTS && c.every(isString) && c[0] !== "";
const isCommandList = (l, least) => Array.isArray(l) && l.length >= least && l.length <= MAX_COMMANDS && l.every(isCommand);
const isStringList = (l) => Array.isArray(l) && l.length <= MAX_ARGUMENTS && l.every(isString);
// a folder's path from the root, its parts joined by `/`, staying inside it
const isFolderPath = (p) => isString(p) && p.length <= MAX_PATH && isPathFromRoot(p);
const isRunSize = (n) => Number.isSafeInteger(n) && n > 0;
const isRecordList = (l) => isStringList(l) && l.length <= MAX_RECORDS;

// each field's test and what it must be, said in the refusal, `stacks` the stacks a `stack` may name; `stack` and
// `green` are required
const fieldsOf = (stacks) => [
  ["stack", (v) => stacks.includes(v), `one of ${stacks.join(", ")}`, true],
  ["green", (v) => isCommandList(v, 1), "a list of argument lists, one per step", true],
  ["tests", isString, "a file pattern", false],
  ["runTests", isCommand, "an argument list", false],
  ["runCases", isCommand, "an argument list", false], // runTests choosing cases by id: the test sweep's left-out runs
  ["beforeTests", (v) => isCommandList(v, 0), "a list of argument lists", false],
  ["lintFile", isCommand, "an argument list", false],
  ["readByNothing", isStringList, "a list of file patterns", false],
  ["docTests", isStringList, "a list of test files", false],
  ["notDocTests", isStringList, "a list of test files", false], // tests naming a readByNothing path, reading none
  ["runLists", isStringList, "a list of file patterns", false], // files listing commands a test runs (reader-tests)
  ["install", isFolderPath, "a folder's path from the root, its parts joined by /", false],
  ["filesPerRun", isRunSize, "a whole number above 0", false],
  ["suppressionRecords", isRecordList, `a list of at most ${MAX_RECORDS} file paths`, false], // read by the check at write
];
const FIELD_NAMES = fieldsOf([]).map(([name]) => name); // the known fields, in their order, whatever the stacks

// The first field the parsed file, a plain object, breaks, as a refusal line, `stacks` the stacks a `stack` may name;
// null when none does.
export function brokenField(parsed, stacks) {
  for (const [name, holds, shape, required] of fieldsOf(stacks)) {
    if (!own(parsed, name)) {
      if (required) return `${COMMANDS_FILE} has no \`${name}\``;
      continue;
    }
    if (!holds(parsed[name])) return `${COMMANDS_FILE}'s \`${name}\` is not ${shape}`;
  }
  if (own(parsed, "docTests") && !own(parsed, "runTests")) return `${COMMANDS_FILE} has \`docTests\` but no \`runTests\``;
  return null;
}

// The known fields of a parsed file no field of which is broken (brokenField), `readByNothing` defaulted: no key from
// the file reaches a prototype.
export function keptFields(parsed) {
  const commands = Object.create(null);
  for (const name of FIELD_NAMES) if (own(parsed, name)) commands[name] = parsed[name];
  commands.readByNothing ??= DEFAULT_READ_BY_NOTHING;
  return commands;
}

// Whether a `green` step is `["{tests}"]`, the project's tests run.
export const isTestsStep = (step) => step.length === 1 && step[0] === TESTS_STEP;

// Whether a project's `commands` (readCommands') declare doc tests: `docTests` given, `[]` counting.
export const declaresDocTests = (commands) => commands.docTests !== undefined;

// Whether a project's `commands` (readCommands') name a doc test: `docTests` holding one at least.
export const namesDocTest = (commands) => (commands.docTests ?? []).length > 0;
