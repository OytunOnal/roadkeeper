#!/usr/bin/env node
// @level main
// Roadkeeper — the structure command for a JavaScript, TypeScript, Astro or Python project:
// `node <roadkeeper>/scripts/structure.mjs [--root <path>] [--packages <folder>]`. It acts on the tree --root names,
// resolved against the working directory, else the directory it is run in (scripts/_root-option.mjs), and writes that
// tree's docs/roadkeeper/structure.json from its code, stamped in the same run, so `files`, `loose` and `digest` are
// current after one run. It records the kernel, domain and application Python files' breaches of purity
// (`impure`), and keeps as their baseline (`impureBaseline`) the files breaking it when it first wrote that field, less
// each one fixed since: the list never grows. What it reads, and what stops it, is the structure module's (scripts/structure/: `graph`,
// `parsers`); its dependency-cruiser, TypeScript and Astro compiler come from the node_modules in the --packages folder,
// a relative one resolved against the tree; with none, in the folder holding the install the tree's commands file names
// (docs/roadkeeper/commands.json, the stack's install when it names none) when that install's last part is node_modules,
// else at the tree's root, as with no commands file or a stack with no install; its Python from the PATH (docs/adr/0003).
// In a linked worktree with none in that folder, the main checkout's is linked in first while the two checkouts'
// package-lock.json beside it match byte for byte, as borrow-install.mjs links it (scripts/project-tools/); otherwise it
// stops, saying where to install: in the main checkout when it has none, else in the worktree.
//
// Writes: the tree's docs/roadkeeper/structure.json, and that install's link, nothing in the folder it is run in; runs no
// program but the PATH's Python 3 on a project holding `.py` files, and asks git for the worktree and its main checkout
// only when the project holds a JavaScript, TypeScript or Astro file. Exits 2, writing nothing, printing its usage line,
// on an argument it does not know or a refused --root; exits 1, writing nothing, on a stop, which it prints: --packages
// naming no folder, the commands file's reader's refusal of a commands file present with no --packages, or the
// module's. Before its closing line it prints the count of Python imports found in no search place and not in the
// standard library, when there is any; the count changes no exit code.

import { writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { rootOption } from "./_root-option.mjs";
import { readNamedInstall, worktreeInstall, worktreeRoot } from "./project-tools/project-tools.mjs";
import { graph, parsers } from "./structure/structure.mjs";

// the --packages option read from the arguments --root leaves: {} with none; { packages }, the folder as typed ("" when
// it names none); or { unknown } for any other argument
function readPackagesOption(args) {
  if (args.length === 0) return {};
  const isPackagesOption = args[0] === "--packages" && args.length <= 2;
  return isPackagesOption ? { packages: args[1] ?? "" } : { unknown: true };
}

const { root, rest, refused } = rootOption(process.argv.slice(2));
const option = readPackagesOption(rest);
const isUsageRefused = refused || option.unknown;
if (isUsageRefused) {
  process.stdout.write("usage: structure.mjs [--root <path>] [--packages <folder>]\n");
  process.exit(2);
}

// the folder the packages are loaded from: { dir, given }, --packages's as given, resolved against the project root,
// else the commands file's (findNamedPackages); or { stop }
function packagesFrom({ packages }) {
  if (packages === undefined) return findNamedPackages();
  return packages ? { dir: resolve(root, packages), given: packages } : { stop: "--packages names no folder" };
}

// the folder holding the install the commands file names, when its last part is node_modules below the root: { dir,
// given }, `given` its path from the root; else the project root and none; or { stop }, the commands file's reader's line
function findNamedPackages() {
  const { install, refused } = readNamedInstall(root);
  if (refused) return { stop: refused };
  const parts = install ? install.split("/") : [];
  if (parts.length < 2 || parts.at(-1) !== "node_modules") return { dir: root, given: null };
  const given = parts.slice(0, -1).join("/");
  return { dir: resolve(root, given), given };
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
  const from = packagesFrom(option);
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
