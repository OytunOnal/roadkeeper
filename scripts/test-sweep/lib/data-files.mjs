// @level infrastructure
// Roadkeeper — the data files a coverage reader's run wrote into its folder, listed for its read: the folder's plain
// files only, by their names.

import { readdirSync } from "node:fs";

// coverage files of one run a reader reads: one a process, a run starting thousands is past the sweep
export const MAX_DATA_FILES = 5000;

// The plain files in `folder`: { names }, by their names, none when it holds none; or { names: [], unlisted }, the
// error's code, when it cannot be listed.
export function listDataFiles(folder) {
  try { return { names: readdirSync(folder, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name) }; }
  catch (e) { return { names: [], unlisted: String(e.code ?? "an error") }; }
}
