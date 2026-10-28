// @level infrastructure
// Roadkeeper — a commit's files laid out in a throwaway folder of the OS temp folder, for the tools that run tests on an older
// commit. Git reads the commit into a temporary index in that folder and checks it out from there, so nothing is written
// under the repository's .git. A working tree's test file is named by its path from the worktree's root, and read only
// when a plain file inside it with no link on the way. The laid-out tree is made a repository of its own, its files in
// its index, so a test reading git's list of files finds them as in a checkout. Each sibling today's package.json
// names (siblings.mjs) is linked beside the tree where it lies beside the main checkout, the tree laid at the main
// checkout's place as deep as they need. A link the tools make is removed before the folder is, and a folder still
// holding one is left whole, and said.

import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isPlainDir, lexists } from "../../_files.mjs";
import { git } from "../../_git.mjs";
import { controlsReplaced, cutAt } from "../../_text.mjs";
import { siblingsOf } from "./siblings.mjs";
import { isLink, linkFolder } from "./worktree.mjs";

const NAME_SHOWN = 200; // characters of a refused file's name shown

// a NUL-separated list of git's, as its entries
const entries = (out) => out.split("\0").filter(Boolean);

// A file name from the command line as a refusal shows it: its controls replaced, cut at NAME_SHOWN.
export const shownName = (name) => cutAt(controlsReplaced(name), NAME_SHOWN);

// The hash of the commit `name` names in the repository at `root`; null when it names none.
export function commitNamed(root, name) {
  try { return git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${name}^{commit}`], root) || null; } catch { return null; }
}

// The hash of the commit `name` names in the worktree at `root`, or null with the refusal handed to `say`. `run`:
// { root, name, label }, `label` the tool's name.
export function namedCommit({ root, name, label }, say) {
  const hash = commitNamed(root, name);
  if (!hash) say(`${label}: no tree built: no commit of that name`);
  return hash;
}

// Every file of the commit `hash`, by its path from the root.
export const commitFiles = (root, hash) => entries(git(["ls-tree", "-r", "-z", "--name-only", hash], root));

// Every file of the working tree at `root` git tracks or does not ignore, by its path from the root, that is on disk.
export const workingFiles = (root) => entries(git(["ls-files", "-z", "-c", "-o", "--exclude-standard"], root))
  .filter((f) => lexists(join(root, f)));

// A file's name as given, with forward slashes and no leading "./".
export const fileName = (name) => name.replace(/\\/g, "/").replace(/^(\.\/)+/, "");

// The test file `name` names in the working tree at `root`, by its path from the root, when it is a plain file inside
// the root with no link on the way; else null.
export function workingFile(root, name) {
  const path = resolve(root, fileName(name));
  const rest = relative(root, path);
  const outside = !rest || rest === ".." || rest.startsWith(".." + sep) || isAbsolute(rest);
  if (outside) return null;
  const folderPlain = dirname(path) === root || isPlainDir(root, dirname(path));
  try { return folderPlain && lstatSync(path).isFile() ? rest.split(sep).join("/") : null; } catch { return null; }
}

// A throwaway folder for one run of a tool: { folder, around, tree, results, index }. With siblings, the tree lies in
// `around` at the main checkout's path from `top` (siblingsOf), so each sibling lies beside it at its own; with none,
// at `tree`. The results and git's index lie apart from both.
function scratchFolders(prefix, { main, top }) {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(folder, "results"));
  const around = join(folder, "around");
  const fromTop = relative(top, main);
  const tree = fromTop ? join(around, fromTop) : join(folder, "tree");
  return { folder, around, tree, results: join(folder, "results"), index: join(folder, "index") };
}

// The commit's files checked out into the tree; the working tree's `copied` files copied in over them; the tree made a
// repository, its files in its index; then the install folder `install` (null: none) linked in from the checkout
// `installFrom` (null: none), the worktree's own install or its main checkout's. `plan`: { hash, tree, index, copied,
// install, installFrom }, `index` git's temporary index. Whether it was laid out.
function layTree(root, plan) {
  const { hash, tree, copied, install, installFrom } = plan;
  const env = { GIT_INDEX_FILE: plan.index };
  try {
    mkdirSync(tree, { recursive: true });
    git(["read-tree", hash], root, env);
    git(["checkout-index", "-a", "-f", `--prefix=${tree.split(sep).join("/")}/`], root, env);
    for (const f of copied) {
      mkdirSync(dirname(join(tree, f)), { recursive: true });
      copyFileSync(join(root, f), join(tree, f));
    }
    git(["init", "-q"], tree);
    git(["add", "-A"], tree);
    if (install && installFrom) linkFolder(tree, installFrom, install);
    return true;
  } catch { return false; }
}

// The sibling at `place`, its path from `top`, linked beside the tree at the same path in `around` (linkFolder), the
// folders holding it made first. Whether the link is there.
function linkSibling(around, top, place) {
  try { mkdirSync(dirname(join(around, place)), { recursive: true }); } catch { return false; }
  linkFolder(around, top, place);
  return isLink(join(around, place));
}

// Each sibling of `siblings` (siblingsOf) linked beside the tree: { lines, links }, `lines` saying the manifest's
// lines, then each path linked or not linked in the manifest's order, `links` those made.
function linkedSiblings(scratch, siblings) {
  const lines = [...siblings.said], links = [];
  for (const sibling of siblings.paths) {
    const place = sibling.refused ? "" : relative(siblings.top, sibling.from);
    const linked = Boolean(place) && linkSibling(scratch.around, siblings.top, place);
    if (linked) links.push(join(scratch.around, place));
    const why = sibling.refused ?? "the link could not be made";
    lines.push(`${shownName(sibling.written)} ${linked ? "linked beside the base" : `not linked: ${why}`}`);
  }
  return { lines, links };
}

// The scratch folder removed, each of `links`, the links the tools made in it, unlinked first. Whether the folder was
// removed.
function removeScratch(scratch, links) {
  for (const link of links.filter(isLink)) { try { unlinkSync(link); } catch { /* left: the folder stays below */ } }
  if (links.some(isLink)) return false;
  rmSync(scratch.folder, { recursive: true, force: true });
  return true;
}

// `body(scratch)` run on the commit's tree laid out in a throwaway folder (layTree), beside the siblings today's
// manifest names (siblingsOf, linkedSiblings), `scratch` { tree, results }; the folder removed after (removeScratch),
// or said when it stays. `run`: { root, label, plan }, `label` the tool's name, `plan` layTree's but its tree and
// index. A promise of body's exit code; 2, said, when git could not lay out the commit.
export async function inCommitTree({ root, label, plan }, say, body) {
  const siblings = siblingsOf(root);
  const scratch = scratchFolders(`roadkeeper-${label}-`, siblings);
  const laidOut = layTree(root, { ...plan, tree: scratch.tree, index: scratch.index });
  const laid = laidOut ? linkedSiblings(scratch, siblings) : { lines: [], links: [] };
  const links = [...(plan.install ? [join(scratch.tree, plan.install)] : []), ...laid.links];
  try {
    if (!laidOut) { say(`${label}: no tree built: git could not lay out the commit`); return 2; }
    for (const line of laid.lines) say(`${label}: ${line}`);
    return await body(scratch);
  } finally {
    if (!removeScratch(scratch, links)) say(`${label}: ${scratch.folder} left whole: a link in it could not be removed`);
  }
}
