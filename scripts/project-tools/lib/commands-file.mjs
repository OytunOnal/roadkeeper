// @level infrastructure
// Roadkeeper — a project's commands file, docs/roadkeeper/commands.json, read and its shape checked. Reads it only as a plain
// file under its cap, in a plain docs/roadkeeper folder, with no link on the way. Refuses, each with a fixed line naming the
// file: a project with no such folder, a file missing, a link or over the cap, text that is not a JSON object, a stack
// it does not know, a field of the wrong shape. Fields it does not know are left alone. `install` and `filesPerRun` left
// out are the stack's adapter's.

import { join } from "node:path";
import { readPlainFile, recordsDir } from "../../_files.mjs";
import { STACKS, adapterOf } from "../adapters/adapters.mjs";

export const COMMANDS_FILE = "docs/roadkeeper/commands.json"; // every tool's one place for the project's commands
const CAP = 64 * 1024;          // bytes: a few dozen commands, each a short argument list
const MAX_COMMANDS = 100;       // commands in one list: a green of a handful of steps, with room
const MAX_ARGUMENTS = 1000;     // arguments in one command: a long list of named test files
const MAX_PATH = 260;           // characters of the install's path: Windows' classic path length
const DEFAULT_READ_BY_NOTHING = ["docs/roadkeeper/**"]; // Roadkeeper's docs folder: what the green never reads

const own = (o, k) => Object.hasOwn(o, k);
const isString = (s) => typeof s === "string";
const isCommand = (c) => Array.isArray(c) && c.length > 0 && c.length <= MAX_ARGUMENTS && c.every(isString) && c[0] !== "";
const isCommandList = (l, least) => Array.isArray(l) && l.length >= least && l.length <= MAX_COMMANDS && l.every(isCommand);
const isStringList = (l) => Array.isArray(l) && l.length <= MAX_ARGUMENTS && l.every(isString);
// a folder's path from the root, its parts joined by `/`: none empty, `.` or `..`, no `\` or `:`, so it stays inside
const isFolderPath = (p) => isString(p) && p.length <= MAX_PATH
  && p.split("/").every((part) => part !== "" && part !== "." && part !== ".." && !/[\\:]/.test(part));
const isRunSize = (n) => Number.isSafeInteger(n) && n > 0;

// each field's test and what it must be, said in the refusal; `stack` and `green` are required
const FIELDS = [
  ["stack", (v) => STACKS.includes(v), `one of ${STACKS.join(", ")}`, true],
  ["green", (v) => isCommandList(v, 1), "a list of argument lists, one per step", true],
  ["tests", isString, "a file pattern", false],
  ["runTests", isCommand, "an argument list", false],
  ["beforeTests", (v) => isCommandList(v, 0), "a list of argument lists", false],
  ["lintFile", isCommand, "an argument list", false],
  ["readByNothing", isStringList, "a list of file patterns", false],
  ["install", isFolderPath, "a folder's path from the root, its parts joined by /", false],
  ["filesPerRun", isRunSize, "a whole number above 0", false],
];

// The first field the parsed file breaks, as a refusal line; null when none does.
function brokenField(parsed) {
  for (const [name, holds, shape, required] of FIELDS) {
    if (!own(parsed, name)) {
      if (required) return `${COMMANDS_FILE} has no \`${name}\``;
      continue;
    }
    if (!holds(parsed[name])) return `${COMMANDS_FILE}'s \`${name}\` is not ${shape}`;
  }
  return null;
}

// { commands } with `readByNothing`, `install` and `filesPerRun` defaulted, or { refused }, the line saying why the
// project at `root` has none.
export function readCommands(root) {
  if (!recordsDir(root)) return { refused: "docs/roadkeeper is missing or a link: not a Roadkeeper project" };
  const text = readPlainFile(join(root, ...COMMANDS_FILE.split("/")), CAP);
  if (text === null) return { refused: `${COMMANDS_FILE} is missing, a link, or over its ${CAP / 1024} KB cap` };
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const isObject = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  if (!isObject) return { refused: `${COMMANDS_FILE} is not a JSON object` };
  const broken = brokenField(parsed);
  if (broken) return { refused: broken };
  const commands = Object.create(null); // the known fields alone: no key from the file reaches a prototype
  for (const [name] of FIELDS) if (own(parsed, name)) commands[name] = parsed[name];
  commands.readByNothing ??= DEFAULT_READ_BY_NOTHING;
  const stack = adapterOf(commands.stack);
  commands.install ??= stack.install;
  commands.filesPerRun ??= stack.filesPerRun;
  return { commands };
}
