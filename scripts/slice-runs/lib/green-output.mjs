// @level infrastructure
// Roadkeeper — a background green's output file, the one its task notification names, read for its slowest test
// files: read-only, a plain file under the OS temp folder with no link on the way from it, under a cap, named as Claude
// Code names it (`….output`).

import { tmpdir } from "node:os";
import { isAbsolute } from "node:path";
import { findSlowestPrinted } from "../../_slowest-lines.mjs";
import { noLinkOnTheWay, readPlainFile, realPath } from "../../_files.mjs";

const OUTPUT_CAP = 16 * 1024 * 1024; // bytes of an output file read: a green prints a few KB
const OUTPUT_ENDING = ".output"; // how Claude Code names a background command's output file

const NOT_FOUND = ["times not found"]; // said for an output file gone, outside the temp folder, a link, or over the cap

// Whether `path` names an output file the read may open: absolute, `….output`, under the OS temp folder's real path
// with no link on the way from it.
const isOutputFile = (path) => isAbsolute(path) && path.endsWith(OUTPUT_ENDING) && noLinkOnTheWay(realPath(tmpdir()), path);

// The green's slowest test files from its output file at `path` (findSlowestPrinted's lines), none when it printed none,
// or a line saying the times were not found when the file cannot be read.
export function readSlowestInOutputFile(path) {
  const text = isOutputFile(path) ? readPlainFile(path, OUTPUT_CAP) : null;
  return text === null ? NOT_FOUND : findSlowestPrinted(text);
}
