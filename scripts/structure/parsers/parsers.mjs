// @level infrastructure
// Roadkeeper — the Parsers port's adapter (../lib/dependency-graph.mjs), its one entry; everything under lib/ is private.
// A list of the language parsers, each taking its files by their ending: the scripts' (lib/script-parser.mjs), the
// JavaScript, TypeScript and Astro files, then Python's (lib/python-parser.mjs), the `.py` files. A parser with no
// files given is not run, so no package is loaded and no Python looked for when there are none; a parser's stop ends
// the read; the tool line names each parser that ran, in the list's order. A file given over 1 MB, the bound on a source file, stops the read before any parser opens one; each
// parser bounds its own walks.

import { statSync } from "node:fs";
import { join } from "node:path";
import { isPython, isScript } from "../lib/source-paths.mjs";
import { mergeResults } from "./lib/merge-results.mjs";
import { pythonParser } from "./lib/python-parser.mjs";
import { scriptParser } from "./lib/script-parser.mjs";
import { SOURCE_MAX_BYTES, sizeStop } from "./lib/source-bounds.mjs";

// The parsers that load from the folder `dir`: { parsers }, the packages loaded by the read that needs them.
export function parsersFrom(dir, given) {
  const languageParsers = [
    { takes: isScript, read: (root, toRead) => scriptParser({ dir, given }, root, toRead) },
    { takes: isPython, read: pythonParser },
  ];
  return { parsers: { read: (root, files, declared) => readCode(languageParsers, root, { files, declared }) } };
}

// what the port's `read` gives (dependency-graph.mjs), or the size gate's stop, or a parser's: each parser of the list
// reads the files it takes, and their results merge (lib/merge-results.mjs)
async function readCode(languageParsers, root, { files, declared }) {
  const oversizedFile = [...files, ...declared].find((f) => statSync(join(root, f)).size > SOURCE_MAX_BYTES);
  if (oversizedFile !== undefined) return sizeStop(oversizedFile);
  const results = [];
  for (const { takes, read } of languageParsers) {
    const taken = files.filter(takes);
    if (!taken.length) continue;
    const parsed = await read(root, { files: taken, declared: declared.filter(takes) });
    if (parsed.stop) return parsed;
    results.push(parsed);
  }
  return mergeResults(results);
}
