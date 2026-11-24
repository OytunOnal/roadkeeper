// @level infrastructure
// Roadkeeper — a project's commands file, docs/roadkeeper/commands.json, read and its shape checked (commands-fields.mjs).
// Reads it only as a plain file under its cap, in a plain docs/roadkeeper folder, with no link on the way. Refuses, each
// with a fixed line naming the file: a project with no such folder, a file missing, a link or over the cap, text that is
// not a JSON object, a field commands-fields.mjs refuses, a stack the adapters do not know among them. `install` and
// `filesPerRun` left out are the stack's adapter's.

import { join } from "node:path";
import { readPlainFile, recordsDir } from "../../_files.mjs";
import { STACKS, adapterOf } from "../adapters/adapters.mjs";
import { COMMANDS_FILE, brokenField, keptFields } from "./commands-fields.mjs";
import { isObject } from "./json-shapes.mjs";

const CAP = 64 * 1024;          // bytes: a few dozen commands, each a short argument list

// { commands } with `readByNothing`, `install` and `filesPerRun` defaulted, or { refused }, the line saying why the
// project at `root` has none.
export function readCommands(root) {
  if (!recordsDir(root)) return { refused: "docs/roadkeeper is missing or a link: not a Roadkeeper project" };
  const text = readPlainFile(join(root, ...COMMANDS_FILE.split("/")), CAP);
  if (text === null) return { refused: `${COMMANDS_FILE} is missing, a link, or over its ${CAP / 1024} KB cap` };
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  if (!isObject(parsed)) return { refused: `${COMMANDS_FILE} is not a JSON object` };
  const broken = brokenField(parsed, STACKS);
  if (broken) return { refused: broken };
  const commands = keptFields(parsed);
  const stack = adapterOf(commands.stack);
  commands.install ??= stack.install;
  commands.filesPerRun ??= stack.filesPerRun;
  return { commands };
}
