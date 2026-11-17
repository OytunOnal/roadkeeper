#!/usr/bin/env node
// @level main
// Roadkeeper — the structure command for a JavaScript, TypeScript, Astro or Python project, run in the project root:
// `node <roadkeeper>/scripts/structure.mjs [--packages <folder>]`. It writes docs/roadkeeper/structure.json from the code and
// stamps it in the same run, so `files`, `loose` and `digest` are current after one run. What it reads, and what stops
// it, is the structure module's (scripts/structure/: `graph`, `parsers`); its dependency-cruiser, TypeScript and Astro
// compiler come from the node_modules at the project root or in the --packages folder, its Python from the PATH
// (docs/adr/0003). In a linked worktree with none in that folder, the main checkout's is linked in first while the two
// checkouts' package-lock.json beside it match byte for byte, as borrow-install.mjs links it (scripts/project-tools/);
// otherwise it stops, saying where to install: in the main checkout when it has none, else in the worktree.
//
// Writes: docs/roadkeeper/structure.json, and that install's link; runs no program but the PATH's Python 3 on a project
// holding `.py` files, and asks git for the worktree and its main checkout only when the project holds a JavaScript,
// TypeScript or Astro file. Exits 1, writing nothing, on a stop, which it prints: --packages naming no folder, or the
// module's. Before its closing line it prints the count of Python imports found in no search place and not in the
// standard library, when there is any; the count changes no exit code.

import { writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { worktreeInstall, worktreeRoot } from "./project-tools/project-tools.mjs";
import { graph, parsers } from "./structure/structure.mjs";

const root = process.cwd();

// the folder the packages are loaded from: { dir, given }, --packages's as given, else the project root and none; or
// { stop }
function packagesFrom(argv) {
  const at = argv.indexOf("--packages");
  if (at < 0) return { dir: root, given: null };
  const given = argv[at + 1];
  return given ? { dir: resolve(root, given), given } : { stop: "--packages names no folder" };
}

// The main checkout's node_modules borrowed into the packages folder `dir` of a linked worktree with none: null, or
// { stop } saying where to install. A folder outside the worktree, or no worktree, borrows nothing.
function borrowInto(dir) {
  const top = worktreeRoot(root);
  if (!top) return null;
  const folder = relative(top, join(dir, "node_modules"));
  if (folder.startsWith("..") || isAbsolute(folder)) return null;
  const { said } = worktreeInstall(top, folder.split(sep).join("/"));
  return said ? { stop: said } : null;
}

// what the run ends on: { line } once structure.json is written, or { stop, refused }
async function run() {
  const from = packagesFrom(process.argv);
  if (from.stop) return from;
  const read = await graph(root, parsers(from.dir, { given: from.given, borrow: () => borrowInto(from.dir) }).parsers);
  if (read.stop) return read;
  writeFileSync(join(root, "docs", "roadkeeper", "structure.json"), read.text);
  return read;
}

// a write that fails is a stop in fixed words: its code, never the path's text
const end = await run().catch((e) => ({ stop: `could not write docs/roadkeeper/structure.json: ${e && e.code ? e.code : "an error"}` }));
if (end.refused && end.refused.length) process.stdout.write(end.refused.join("\n") + "\n");
if (end.nowhereLine) process.stdout.write(`structure: ${end.nowhereLine}\n`);
process.stdout.write(`structure: ${end.stop ? `${end.stop} — nothing written` : end.line}\n`);
process.exitCode = end.stop ? 1 : 0;
