// @level infrastructure
// Roadkeeper — the `--root <path>` option of the commands that act on a tree: the tree it names, resolved against the working
// directory, else the working directory.
//
// `--root=<path>` reads as `--root <path>`. A `--root` with no value, given twice, or naming no directory is refused;
// each command says its own refusal.

import { statSync } from "node:fs";
import { resolve } from "node:path";

const OPTION = "--root"; // the option's one spelling, alone or joined to its value by `=`

const isDirectory = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

// { root, rest, refused }: the tree the arguments name, null when refused, and the arguments but --root and its value.
export function rootOption(argv) {
  const given = [];
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === OPTION) given.push(argv[++i] ?? "");
    else if (a.startsWith(OPTION + "=")) given.push(a.slice(OPTION.length + 1));
    else rest.push(a);
  }
  if (given.length === 0) return { root: resolve(process.cwd()), rest, refused: false };
  const root = given.length === 1 && given[0] ? resolve(given[0]) : null;
  return root && isDirectory(root) ? { root, rest, refused: false } : { root: null, rest, refused: true };
}
