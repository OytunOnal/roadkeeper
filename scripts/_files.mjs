// @level infrastructure
// Roadkeeper — reading and writing files safely: the plain-directory test, the docs/roadkeeper folder, the plain-file read, the
// inside-the-root test and the whole-file write; a path's real path, whether anything lies at it, and its path from a
// root it lies in.
//
// Text from a repository or a tracker is a stranger's: read only from plain files with no link on the way, and
// refused over a cap; a path is written to only inside the project.

import { randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

// The path with its links resolved, or the path as given when it cannot be.
export const realPath = (p) => { try { return realpathSync(p); } catch { return p; } };

// Whether anything lies at the path, a broken link included.
export const lexists = (p) => { try { lstatSync(p); return true; } catch { return false; } };

// The path of `file` from `root`, both read through their links, with `/`; null when it is not inside the root.
export function pathFrom(root, file) {
  const rest = relative(realPath(root), realPath(file));
  const inside = rest && !rest.startsWith("..") && !isAbsolute(rest);
  return inside ? rest.split("\\").join("/") : null;
}

// No segment from the root to the target is a symlink or a junction. A realpath check alone would pass a link that
// resolves back inside the project.
function noLinkOnTheWay(root, target) {
  const rest = relative(root, target);
  if (!rest || rest.startsWith("..")) return false;
  let at = root;
  for (const part of rest.split(sep)) {
    at = join(at, part);
    try {
      if (lstatSync(at).isSymbolicLink()) return false;
    } catch { return true; } // does not exist yet: nothing to follow
  }
  return true;
}

// a directory to walk: a plain directory, inside the project, with no link on the way
export function isPlainDir(root, dir) {
  try {
    const st = lstatSync(dir);
    if (st.isSymbolicLink() || !st.isDirectory()) return false;
  } catch { return false; }
  return noLinkOnTheWay(root, dir);
}

// the project's docs/roadkeeper folder when it is a plain directory with no link on the way, else null
export function recordsDir(root) {
  const dir = join(root, "docs", "roadkeeper");
  return isPlainDir(root, dir) ? dir : null;
}

// A plain file's text, with no byte-order mark and LF line endings, or null when it is absent, a link, not a file or
// over the cap.
export function readPlainFile(path, cap) {
  try {
    const st = lstatSync(path);
    if (st.isSymbolicLink() || !st.isFile() || st.size > cap) return null;
    return readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  } catch { return null; }
}

// Writes `text` to `path` whole, its folder made: into a temporary file in the same folder, then renamed into place, so
// a reader, or a redraw running beside this one, finds the old file or the new one, never part of either. The caller
// checks that `path` is inside the project (insideRoot). The temporary file takes a random name and is created only
// when no entry has it, a link included: a name a repository planted is never written through. A failure is thrown,
// the temporary file this write created removed.
export function replaceFile(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${randomBytes(8).toString("hex")}.tmp`);
  try {
    writeFileSync(temporary, text, { encoding: "utf8", flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") rmSync(temporary, { force: true }); // an entry already there is not this write's
    throw e;
  }
  try {
    renameSync(temporary, path);
  } catch (e) {
    rmSync(temporary, { force: true });
    throw e;
  }
}

// A path to write to: inside the project on the disk, not merely in the string; no link on any segment; never the
// repository's own .git, however it is spelled.
export function insideRoot(root, p) {
  const real = (x) => { try { return realpathSync(x); } catch { return null; } };
  const base = real(root);
  if (!base) return false;
  const under = (x) => {
    const a = process.platform === "win32" ? base.toLowerCase() : base;
    const b = process.platform === "win32" ? x.toLowerCase() : x;
    return b === a || b.startsWith(a.endsWith(sep) ? a : a + sep);
  };
  // the anchor is the deepest part of the path that exists today: new directories will hang from its real path
  let at = dirname(p), anchor = null;
  for (let i = 0; i < 64 && !anchor; i++) {
    anchor = real(at);
    const up = dirname(at);
    if (up === at) break;
    at = up;
  }
  if (!anchor || !under(anchor)) return false;
  const self = real(p);
  if (self && !under(self)) return false; // an existing file that is a link out
  if (!noLinkOnTheWay(root, p)) return false;
  const segs = relative(root, p).split(sep);
  if (segs.some((s) => s.includes(":"))) return false; // an NTFS stream writes into the file before the colon
  if (segs.some((s) => s.toLowerCase().replace(/[. ]+$/, "") === ".git")) return false; // `.git.` and `.git ` are .git on Windows
  try {
    const rp = realpathSync(p).toLowerCase(), rg = realpathSync(join(root, ".git")).toLowerCase();
    if (rp === rg || rp.startsWith(rg + sep)) return false;
  } catch { /* the target may not exist yet: the segment test above decided */ }
  return true;
}
