// @level infrastructure
// Roadkeeper — the siblings a commit's tree is laid beside: each folder the running worktree's own package.json, at the
// worktree's root, names by a `file:` path leaving the main checkout, in its dependencies, devDependencies or
// optionalDependencies. Asks git for the worktree's main checkout (worktree.mjs); where git names none, the worktree's
// root stands in for it. Reads the manifest, a plain file under MANIFEST_CAP with no link on the way, and the kind of
// each path it names, resolved beside the main checkout. Refuses a path holding the main checkout, one of more than
// MAX_STEPS steps up from it, one naming nothing or no folder, one with a link on the way from the ancestor it climbs
// to, and each past MAX_SIBLINGS; a path inside the main checkout, an absolute one, or one inside another sibling is
// reached without a link. Writes nothing.

import { lstatSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { isPlainDir, lexists, readPlainFile } from "../../_files.mjs";
import { checkouts } from "./worktree.mjs";

const MANIFEST = "package.json"; // npm's manifest, at the root
const MANIFEST_CAP = 1024 * 1024; // bytes of a package.json read: a manifest's text, with room
const DEPENDENCY_MAPS = ["dependencies", "devDependencies", "optionalDependencies"]; // the maps npm installs from
const MAX_SIBLINGS = 32; // siblings linked in one run: a wide layout's, with room
const MAX_STEPS = 8; // `..` steps a sibling's path takes: a deep layout's, with room
const FILE_SPECIFIER = "file:"; // npm's specifier for a dependency by its path

const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// The `file:` paths of today's manifest at `root`, in its order: { written, said }, `said` the lines of what was not
// read.
function manifestPaths(root) {
  const path = join(root, MANIFEST);
  if (!lexists(path)) return { written: [], said: [] };
  const text = readPlainFile(path, MANIFEST_CAP);
  let manifest = null;
  try { manifest = text === null ? null : JSON.parse(text); } catch { /* not JSON: said below */ }
  if (!isMap(manifest)) return { written: [], said: [`${MANIFEST} not read: no sibling linked`] };
  const written = [], said = [];
  for (const name of Object.keys(manifest).filter((k) => DEPENDENCY_MAPS.includes(k))) {
    const dependencies = isMap(manifest[name]) ? Object.assign(Object.create(null), manifest[name]) : null;
    const specifiers = dependencies ? Object.values(dependencies) : [];
    if (!dependencies || specifiers.some((s) => typeof s !== "string")) { said.push(`${MANIFEST}'s ${name} is no map of strings: skipped`); continue; }
    written.push(...specifiers.filter((s) => s.startsWith(FILE_SPECIFIER)).map((s) => s.slice(FILE_SPECIFIER.length)));
  }
  return { written, said };
}

// The leading `..` segments of a path's `parts`: the folders it climbs before it goes down.
function stepsUp(parts) {
  const down = parts.findIndex((p) => p !== "..");
  return down === -1 ? parts.length : down;
}

// The folder `steps` folders above `dir`.
const ancestor = (dir, steps) => (steps ? ancestor(dirname(dir), steps - 1) : dir);

// A path as the file system compares it: case-insensitive on Windows.
const foldCase = (p) => (process.platform === "win32" ? p.toLowerCase() : p);

// Whether the folder `outer` is the folder `inner` or holds it, compared as insideRoot (_files.mjs) compares.
function holds(outer, inner) {
  const [holder, held] = [foldCase(outer), foldCase(inner)];
  return held === holder || held.startsWith(holder.endsWith(sep) ? holder : holder + sep);
}

// Why the folder at `from`, `steps` folders up from the main checkout `main`, cannot be linked; null when it can.
function folderRefusal(main, from, steps) {
  let st;
  try { st = lstatSync(from); } catch { return "nothing there"; }
  if (!st.isDirectory() && !st.isSymbolicLink()) return "not a folder";
  return isPlainDir(ancestor(main, steps), from) ? null : "a link on the way";
}

// A `file:` path read against the main checkout `main`: { written, from, steps } for a sibling, { written, from,
// refused } for one refused, null for one reached without a link.
function classifyPath(main, written) {
  if (isAbsolute(written)) return null;
  const from = resolve(main, written);
  const parts = relative(main, from).split(sep);
  const steps = stepsUp(parts);
  if (!steps) return null;
  if (steps === parts.length) return { written, from, refused: "it holds the root" };
  if (stepsUp(posix.normalize(written.replace(/\\/g, "/")).split("/")) > MAX_STEPS) return { written, from, refused: `more than ${MAX_STEPS} steps up` };
  const refused = folderRefusal(main, from, steps);
  return refused ? { written, from, refused } : { written, from, steps };
}

// The siblings kept from `found`, in its order: none inside another kept, at most MAX_SIBLINGS; { kept, past }.
function keptSiblings(found) {
  let kept = [];
  const past = new Set();
  for (const s of found) {
    if (kept.some((k) => holds(k.from, s.from))) continue;
    const inner = kept.filter((k) => holds(s.from, k.from));
    if (kept.length - inner.length >= MAX_SIBLINGS) { past.add(s); continue; }
    kept = [...kept.filter((k) => !inner.includes(k)), s];
  }
  return { kept, past };
}

// The siblings of the worktree at `root`, named by its own manifest: { main, top, paths, said }. `main`, the checkout
// they are resolved beside: the worktree's main checkout (checkouts), the root itself where git names none; `top`,
// main's ancestor as many folders up as the farthest sibling linked climbs, main itself for none; `paths`, in the
// manifest's order, each { written, from } to link or { written, refused } to say, none inside a sibling kept; `said`,
// the manifest's lines.
export function siblingsOf(root) {
  const { main } = checkouts(root);
  const { written, said } = manifestPaths(root);
  const candidates = written.map((w) => classifyPath(main, w)).filter(Boolean);
  const { kept, past } = keptSiblings(candidates.filter((c) => !c.refused));
  const insideKept = (c) => kept.some((k) => k !== c && holds(k.from, c.from));
  const paths = candidates.filter((c) => kept.includes(c) || ((c.refused || past.has(c)) && !insideKept(c)))
    .map((c) => (past.has(c) ? { written: c.written, refused: `past ${MAX_SIBLINGS} siblings` } : c));
  const steps = Math.max(0, ...kept.map((k) => k.steps));
  return { main, top: ancestor(main, steps), paths, said };
}
