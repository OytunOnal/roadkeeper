// @level infrastructure
// Roadkeeper — a project's copy of the plugin's lint rules (scripts/lint/): roadkeeper-lint/ at the project's root, written whole
// and compared file by file, line endings aside. Reads plain files with no link on the way, each under its cap, in a
// walk bounded by depth and count; a link, an oversized file or a walk past its bounds makes the copy differ. Writes
// only inside the copy's folder, after emptying it.

import { readdirSync, rmSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { insideRoot, isPlainDir, lexists, readPlainFile, replaceFile } from "../../_files.mjs";

export const RULES_COPY = "roadkeeper-lint"; // the copy's folder at the project's root; outside docs/roadkeeper/, so the green reads it
// what a refusal names: the copy command by its absolute path, quoted, since a session's shell has no plugin root
export const COPY_COMMAND = `node "${fileURLToPath(new URL("../../copy-lint-rules.mjs", import.meta.url))}"`;
const SOURCE = fileURLToPath(new URL("../../lint/", import.meta.url)); // the plugin's own rules
const CAP = 256 * 1024;  // bytes of one rules file: a few hundred lines
const MAX_FILES = 100;   // files under the rules' folder: a handful of rules, with room
const MAX_DEPTH = 4;     // folders under the rules' folder: the entry's rules/ and room

// The files under `dir` as a Map of their paths from it ("/"-joined) to their text, or null when a link, a file over
// its cap, or more files or folders than the bounds lie under it.
function filesUnder(dir) {
  const found = new Map();
  const walk = (at, depth) => readdirSync(at, { withFileTypes: true }).every((entry) => {
    const path = join(at, entry.name);
    if (entry.isDirectory()) return depth < MAX_DEPTH && walk(path, depth + 1);
    const text = entry.isFile() ? readPlainFile(path, CAP) : null;
    if (text !== null) found.set(relative(dir, path).split(sep).join("/"), text);
    return text !== null && found.size <= MAX_FILES;
  });
  try { return walk(dir, 0) ? found : null; } catch { return null; }
}

const sameFiles = (a, b) => a.size === b.size && [...a].every(([path, text]) => b.get(path) === text);

// Whether the project at `root` holds a copy that differs from the plugin's rules; a project with none holds no copy
// to differ.
export function copyDiffers(root) {
  const copy = join(root, RULES_COPY);
  if (!lexists(copy)) return false;
  const theirs = isPlainDir(root, copy) ? filesUnder(copy) : null;
  const ours = filesUnder(SOURCE);
  return !theirs || !ours || !sameFiles(ours, theirs);
}

// The plugin's rules written into the project at `root`, its copy's folder emptied first: { count } of the files
// written, or { refused }, the line saying why nothing was.
export function writeCopy(root) {
  const copy = join(root, RULES_COPY);
  const ours = filesUnder(SOURCE);
  if (!ours) return { refused: "the plugin's lint rules could not be read" };
  const folderSafe = insideRoot(root, copy) && (!lexists(copy) || isPlainDir(root, copy));
  if (!folderSafe) return { refused: `${RULES_COPY} is a link or not a folder: nothing written` };
  rmSync(copy, { recursive: true, force: true });
  for (const [path, text] of ours) replaceFile(join(copy, ...path.split("/")), text);
  return { count: ours.size };
}
