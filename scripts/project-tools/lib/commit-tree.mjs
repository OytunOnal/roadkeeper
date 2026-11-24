// @level infrastructure
// Roadkeeper — a commit's files laid out in a throwaway folder of the OS temp folder, for the tools that run tests on
// an older commit. Git reads the commit into a temporary index in that folder and checks it out from there, so
// nothing is written under the repository's .git. A working tree's test file is named by its path from the worktree's
// root, and read only when a plain file inside it with no link on the way; its files, every one or the uncommitted
// ones, are git's lists, each bounded at git's own bound and LISTING_PER_FILE a file the index tracks, a list that ran
// out saying so. The laid-out tree is made a repository of its own, its files in its index, so a test reading
// git's list of files finds them as in a checkout. Each sibling today's package.json names (siblings.mjs) is linked
// beside the tree where it lies beside the main checkout, the tree laid at the main checkout's place as deep as they
// need. A link the tools make is removed before the folder is, and a folder still holding one is left whole, and said.
// Each git call laying out the commit is bounded at git's own bound and LAYOUT_PER_FILE a file of the commit, counted by
// its listing; a refusal names the step that stopped: a git call, with its bound when it ran out, the tree's folder
// or a copied file.

import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isPlainDir, lexists } from "../../_files.mjs";
import { GIT_TIMEOUT, git, gitWithin, trackedFiles } from "../../_git.mjs";
import { callStopped, limitFor } from "../../_time-limit.mjs";
import { shownName } from "./shown-name.mjs";
import { siblingsOf } from "./siblings.mjs";
import { isLink, linkFolder } from "./worktree.mjs";

// milliseconds each file of the commit adds to a layout call's bound: three times the slowest call measured laying out
// Roadkeeper's own tree, `git add -A` at about 6.5 ms a file
export const LAYOUT_PER_FILE = 20;
// milliseconds each file the index tracks adds to a git listing's bound: three times the slowest listing measured over
// 20,000 files, `ls-files -c -o` at 1.1 us a file
const LISTING_PER_FILE = 0.0033;

// One of the layout's steps stopped: its message says the step, and a git call's bound when it ran out.
class LayoutStopped extends Error {}

// a NUL-separated list of git's, as its entries
const entries = (out) => out.split("\0").filter(Boolean);

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

// The hash of the tree of the commit `commit` in the repository at `root`; throws when git cannot say.
export const treeOf = (root, commit) => git(["rev-parse", "--verify", "-q", `${commit}^{tree}`], root);

// The bound of a git listing in the worktree at `root`: git's own bound and LISTING_PER_FILE a file its index tracks.
export const listingLimit = (root) => limitFor({ floor: GIT_TIMEOUT, perFile: LISTING_PER_FILE }, trackedFiles(root));

// A git listing in the worktree at `root`, NUL-separated, as its entries, ended at listingLimit; throws an error whose
// message says the call stopped (callStopped) and whose `code` is git's.
function listing(args, root) {
  const bound = listingLimit(root);
  try { return entries(gitWithin(args, root, { timeout: bound })); } catch (e) {
    throw Object.assign(new Error(callStopped(`git ${args[0]}`, bound, e)), { code: e.code });
  }
}

// Every file of the commit `hash`, by its path from the root.
export const commitFiles = (root, hash) => listing(["ls-tree", "-r", "-z", "--name-only", hash], root);

// Every file of the working tree at `root` git tracks or does not ignore, by its path from the root, that is on disk.
export const workingFiles = (root) => listing(["ls-files", "-z", "-c", "-o", "--exclude-standard"], root)
  .filter((f) => lexists(join(root, f)));

// Of `paths`, by their paths from the worktree's root `root`, those the commit `hash` holds: { held, differing },
// `differing` those of them whose working tree's file differs from the commit's copy. Throws when git fails (listing).
export function heldByCommit(root, hash, paths) {
  if (!paths.length) return { held: [], differing: [] };
  const inCommit = new Set(commitFiles(root, hash));
  const held = paths.filter((p) => inCommit.has(p));
  if (!held.length) return { held, differing: [] };
  const specs = held.map((p) => `:(literal)${p}`);
  const changed = new Set(listing(["diff", "--name-only", "--no-renames", "-z", hash, "--", ...specs], root));
  return { held, differing: held.filter((p) => changed.has(p)) };
}

// whether the worktree at `root` has a commit yet: HEAD names one
const hasHead = (root) => { try { git(["rev-parse", "--verify", "-q", "HEAD"], root); return true; } catch { return false; } };

// Whether the last commit of the worktree at `root` holds `path`, its path from the root: false with no commit yet.
export function inLastCommit(root, path) {
  try { git(["cat-file", "-e", `HEAD:${path}`], root); return true; } catch { return false; }
}

// The uncommitted files of the working tree at `root`, by their paths from it: changed against HEAD, staged or not, a
// deleted one included, then the untracked files git does not ignore; with no commit yet (hasHead), every file in the
// index first. Throws when git fails (listing).
export function uncommittedFiles(root) {
  const changed = hasHead(root) ? listing(["diff", "--name-only", "--no-renames", "-z", "HEAD", "--"], root)
    : listing(["ls-files", "-z", "-c"], root);
  return [...new Set([...changed, ...listing(["ls-files", "-z", "-o", "--exclude-standard"], root)])];
}

// A file's name as given, with forward slashes and no leading "./".
export const fileName = (name) => name.replace(/\\/g, "/").replace(/^(\.\/)+/, "");

// The path `name` gives from the root `root`, `/`-separated, when it leads inside the root and is not the root itself;
// else null. Reads nothing on disk.
export function pathFromRoot(root, name) {
  const rest = relative(root, resolve(root, fileName(name)));
  const outside = !rest || rest === ".." || rest.startsWith(".." + sep) || isAbsolute(rest);
  return outside ? null : rest.split(sep).join("/");
}

// The path a name gives from the root `root`, `/`-separated (pathFromRoot); null when it leads outside the root, or is
// given absolute or from a drive, so no path from the root.
export const pathInside = (root, name) => (isAbsolute(name) || /^[A-Za-z]:/.test(name) ? null : pathFromRoot(root, name));

// Whether anything, a link included, is at the path `path` from the root `root`.
export const onDisk = (root, path) => lexists(join(root, path));

// The test file `name` names in the working tree at `root`, by its path from the root, when it is a plain file inside
// the root with no link on the way; else null.
export function workingFile(root, name) {
  const rest = pathFromRoot(root, name);
  if (!rest) return null;
  const path = resolve(root, rest);
  const folderPlain = dirname(path) === root || isPlainDir(root, dirname(path));
  try { return folderPlain && lstatSync(path).isFile() ? rest : null; } catch { return null; }
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

// `step()`'s result; when it throws, LayoutStopped with `said(error)`.
function layoutStep(step, said) {
  try { return step(); } catch (e) { throw new LayoutStopped(said(e)); }
}

// One git call laying out the commit, in `cwd`, ended after `bound` milliseconds (layoutStep, callStopped). `call`:
// { own, bound }, `own` gitWithin's.
const layoutCall = (args, cwd, { own, bound }) =>
  layoutStep(() => gitWithin(args, cwd, { own, timeout: bound }), (e) => callStopped(`git ${args[0]}`, bound, e));

// The working tree's file `f` copied over the tree's, the folders holding it made first; a link the commit laid in its
// place removed first, so nothing is written through it.
function copiedIn(root, tree, f) {
  const to = join(tree, f);
  mkdirSync(dirname(to), { recursive: true });
  if (isLink(to)) unlinkSync(to);
  copyFileSync(join(root, f), to);
}

// The commit's files checked out into the tree; the working tree's `copied` files copied in over them; the tree made a
// repository, its files in its index; then the install folder `install` (null: none) linked in from the checkout
// `installFrom` (null: none), the worktree's own install or its main checkout's. Each git call is bounded at
// GIT_TIMEOUT and LAYOUT_PER_FILE a file of the commit. `plan`: { hash, tree, index, copied, install, installFrom },
// `index` git's temporary index. Null once laid out; else the step that stopped it (LayoutStopped's message).
function layTree(root, plan) {
  const { hash, tree, copied, install, installFrom } = plan;
  const own = { GIT_INDEX_FILE: plan.index };
  try {
    const files = layoutStep(() => commitFiles(root, hash).length, (e) => e.message);
    const bound = limitFor({ floor: GIT_TIMEOUT, perFile: LAYOUT_PER_FILE }, files);
    layoutStep(() => mkdirSync(tree, { recursive: true }), () => "the tree's folder could not be made");
    layoutCall(["read-tree", hash], root, { own, bound });
    layoutCall(["checkout-index", "-a", "-f", `--prefix=${tree.split(sep).join("/")}/`], root, { own, bound });
    for (const f of copied) layoutStep(() => copiedIn(root, tree, f), () => `${shownName(f)} could not be copied in`);
    layoutCall(["init", "-q"], tree, { bound });
    layoutCall(["add", "-A"], tree, { bound });
    if (install && installFrom) linkFolder(tree, installFrom, install);
    return null;
  } catch (e) {
    if (e instanceof LayoutStopped) return e.message;
    throw e;
  }
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
  const stopped = layTree(root, { ...plan, tree: scratch.tree, index: scratch.index });
  const laidOut = stopped === null;
  const laid = laidOut ? linkedSiblings(scratch, siblings) : { lines: [], links: [] };
  const links = [...(plan.install ? [join(scratch.tree, plan.install)] : []), ...laid.links];
  try {
    if (!laidOut) { say(`${label}: no tree built: git could not lay out the commit: ${stopped}`); return 2; }
    for (const line of laid.lines) say(`${label}: ${line}`);
    return await body(scratch);
  } finally {
    if (!removeScratch(scratch, links)) say(`${label}: ${scratch.folder} left whole: a link in it could not be removed`);
  }
}
