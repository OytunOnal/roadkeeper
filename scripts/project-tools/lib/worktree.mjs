// @level infrastructure
// Roadkeeper — the worktree a tool runs in: its root, its main checkout, and the main checkout's install linked into it
// while the worktree's pins are the main checkout's: its package-lock.json beside the install folder the same, byte for
// byte. Asks git (scripts/_git.mjs) and reads the two lockfiles, plain files under their cap with no link on the way.
// Writes only the install's link, at its path in the worktree, and only where nothing lies: a folder or a link already
// there is the worktree's own and is left, but a link to the main checkout's install, removed once the pins differ.

import { lstatSync, readFileSync, renameSync, symlinkSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { isPlainDir, lexists, realPath } from "../../_files.mjs";
import { git, mainCheckout } from "../../_git.mjs";

const LOCKFILE = "package-lock.json";  // npm's pins, beside the install folder
const LOCK_CAP = 64 * 1024 * 1024;     // bytes of a lockfile read: a large project's pins, with room

// The root of the worktree holding `dir`, or null outside one.
export function worktreeRoot(dir) {
  try { return resolve(git(["rev-parse", "--show-toplevel"], dir)); } catch { return null; }
}

const samePath = (a, b) => (process.platform === "win32"
  ? realPath(a).toLowerCase() === realPath(b).toLowerCase() : realPath(a) === realPath(b));

// { main, linked }: the main checkout of the worktree at `root` (the root itself when git keeps the repository elsewhere
// than a checkout's .git), and whether `root` is a linked worktree of it.
export function checkouts(root) {
  const main = mainCheckout(root);
  return main ? { main: resolve(main), linked: !samePath(main, root) } : { main: root, linked: false };
}

// Whether the worktree at `root` belongs to the clone holding the folder `dir`: the same main checkout.
export function sameClone(root, dir) {
  const other = worktreeRoot(dir);
  return Boolean(other) && samePath(checkouts(root).main, checkouts(other).main);
}

const isPlainFolder = (p) => { try { const st = lstatSync(p); return st.isDirectory() && !st.isSymbolicLink(); } catch { return false; } };
// Whether a symlink or a junction lies at the path.
export const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };

// The folder at the path `folder` inside `from`, linked at the same path inside the tree at `root` (a junction on
// Windows), when nothing lies there, the folder holding it does, and `from`'s is a plain folder. Made at a temporary
// name beside it and renamed into place, so the path only ever holds nothing or a whole link: Windows makes a junction
// in two steps. One another tool laid first is kept.
export function linkFolder(root, from, folder) {
  const path = join(root, folder);
  const source = join(from, folder);
  if (lexists(path) || !isPlainFolder(source)) return;
  const temporary = join(dirname(path), `.roadkeeper-linking-${process.pid}-${basename(path)}`);
  try {
    symlinkSync(source, temporary, process.platform === "win32" ? "junction" : "dir");
    renameSync(temporary, path);
  } catch {
    try { unlinkSync(temporary); } catch { /* never made, or already renamed */ }
  }
}

// The bytes of the lockfile beside the install folder `folder` in the checkout at `root`; null when it is no plain file
// under LOCK_CAP with no link on the way.
function lockBytes(root, folder) {
  const dir = dirname(join(root, folder));
  const path = join(dir, LOCKFILE);
  if (dir !== resolve(root) && !isPlainDir(root, dir)) return null;
  try {
    const st = lstatSync(path);
    return st.isFile() && st.size <= LOCK_CAP ? readFileSync(path) : null;
  } catch { return null; }
}

// whether the two checkouts pin the same packages: each holds the lockfile, the same byte for byte
function samePins(root, main, folder) {
  const ours = lockBytes(root, folder);
  const theirs = lockBytes(main, folder);
  return ours !== null && theirs !== null && ours.equals(theirs);
}

// The line a tool says when the main checkout's install is not linked into a worktree pinning other packages.
const unpinnedLine = (folder) =>
  `${folder} is not linked from the main checkout: this worktree's ${LOCKFILE} differs from the main checkout's; install in this worktree`;

// The install folder `folder` (null: none) of the worktree at `root`: { from, said }. `from`, the checkout whose install
// a run there uses: the root itself, unless it is a linked worktree with none of its own, which gets its main checkout's
// linked in (linkFolder) while the two pin the same packages (samePins); null when there is none to use. `said`, when
// they do not, the fixed line saying to install in the worktree; a link to the main checkout's install already there is
// removed first.
export function worktreeInstall(root, folder) {
  if (!folder) return { from: null };
  const { main, linked } = checkouts(root);
  const path = join(root, folder);
  const source = join(main, folder);
  const ours = isLink(path) && samePath(path, source);
  const itsOwn = lexists(path) && !ours;
  if (!linked || itsOwn) return { from: root };
  if (!isPlainFolder(source)) return { from: null };
  if (!samePins(root, main, folder)) {
    if (ours) { try { unlinkSync(path); } catch { /* left: the run finds it and fails */ } }
    return { from: null, said: unpinnedLine(folder) };
  }
  linkFolder(root, main, folder);
  return { from: main };
}
