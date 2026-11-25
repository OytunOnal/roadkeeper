// @level infrastructure
// Roadkeeper — git and the PATH: a program found on the PATH's absolute folders, one pinned `git` call, the paths git
// keeps fixed for a folder and the variables it lists as its own (each asked once a process and kept for its life), a
// repository's main checkout, the files a worktree's index tracks, and the shape of a git object's full name.
//
// A program runs as separate arguments, never through a shell, found on the PATH's absolute folders alone: Windows runs
// a bare name from the current folder first, and a program in the project under check must never run. No `git` there
// reads as git failing.

import { execFileSync } from "node:child_process";
import { accessSync, closeSync, constants, openSync, readSync, statSync } from "node:fs";
import { basename, delimiter, dirname, isAbsolute, join } from "node:path";

export const GIT_TIMEOUT = 10000; // milliseconds one `git` call may take, unless its caller bounds it (gitWithin)
const MAX_PATH_FOLDERS = 1000; // PATH folders looked in for a program
const INDEX_HEADER = 12; // bytes of git's index header: its signature, its version and its count of entries
export const OBJECT_HASH = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/; // a full SHA-1 or SHA-256 object name, nothing else
const SHORT_HASH = 12; // characters of an object name a line shows: unique in any repository of this size

// An object name as a line shows it, its first SHORT_HASH characters.
export const shortHash = (hash) => hash.slice(0, SHORT_HASH);

// a file this process may run
function isPlainProgram(p) {
  try { accessSync(p, constants.X_OK); return statSync(p).isFile(); } catch { return false; }
}

// A program's absolute path from the PATH's absolute folders alone, `extension` added on Windows, or null.
export function findProgram(name, extension = ".exe") {
  const file = process.platform === "win32" ? name + extension : name;
  for (const folder of (process.env.PATH || "").split(delimiter).slice(0, MAX_PATH_FOLDERS)) {
    const exe = join(folder, file);
    const found = isAbsolute(folder) && isPlainProgram(exe);
    if (found) return exe;
  }
  return null;
}

// One git call in `cwd`, its output trimmed; throws when git is not on the PATH, fails or takes longer than
// GIT_TIMEOUT. `own`, the caller's own variables (gitWithin).
export const git = (args, cwd, own = {}) => gitWithin(args, cwd, { own });

// One git call in `cwd`, its output trimmed, ended after `timeout` milliseconds, GIT_TIMEOUT when none is given;
// throws when git is not on the PATH, fails or runs out, an error whose `code` is "ETIMEDOUT" when it ran out. The
// opened repository's config cannot turn it into a program: the keys that run one are pinned (`core.fsmonitor`, `core.hooksPath`, `log.showSignature`), the
// `GIT_*` variables that point git elsewhere (a hook's GIT_DIR) are dropped, and nothing is fetched. `own`, the
// caller's own variables, set after the drop (a temporary index, say).
export function gitWithin(args, cwd, { own = {}, timeout = GIT_TIMEOUT }) {
  const program = findProgram("git");
  if (!program) throw new Error("git is not on the PATH");
  const kept = Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith("GIT_"));
  const env = Object.assign(Object.create(null), Object.fromEntries(kept), own, { GIT_NO_LAZY_FETCH: "1" });
  return execFileSync(program, ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/nonexistent",
    "-c", "log.showSignature=false", ...args], {
    cwd, encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"],
    env, windowsHide: true,
  }).trim();
}

// The paths git keeps fixed for a folder, each asked by `rev-parse --path-format=absolute` with these words.
const GIT_PATH_WORDS = {
  top: ["--show-toplevel"],       // the worktree's root
  common: ["--git-common-dir"],   // the git folder the repository's worktrees share
  index: ["--git-path", "index"], // the worktree's own index
  objects: ["--git-path", "objects"],
};
const keptGitPaths = new Map(); // folder → the paths git has said for it, for this process's life
let keptLocalVariables = null;   // `rev-parse --local-env-vars`' answer, once said

// The four paths of the folder `dir`, asked of git in one call: { top, common, index, objects }; none when git cannot
// say them all at once (no worktree there, a bare repository).
function askEveryGitPath(dir) {
  const names = Object.keys(GIT_PATH_WORDS);
  const said = Object.create(null);
  try {
    const lines = git(["rev-parse", "--path-format=absolute", ...Object.values(GIT_PATH_WORDS).flat()], dir).split(/\r?\n/);
    if (lines.length === names.length) names.forEach((name, k) => { said[name] = lines[k]; });
  } catch { /* each asked alone, as it is wanted */ }
  return said;
}

// The absolute path git keeps for the folder `dir`, `name` one of GIT_PATH_WORDS'. Git is asked once for all four per
// folder in a process (askEveryGitPath), every git call dropping the caller's GIT_* variables (gitWithin), so the
// folder alone decides the answer; when that call fails each is asked alone. An answer is kept for the process's life;
// a failure throws as git does and is never kept.
export function findGitPath(dir, name) {
  if (!keptGitPaths.has(dir)) keptGitPaths.set(dir, askEveryGitPath(dir));
  const kept = keptGitPaths.get(dir);
  if (!kept[name]) kept[name] = git(["rev-parse", "--path-format=absolute", ...GIT_PATH_WORDS[name]], dir);
  return kept[name];
}

// The variables git lists as pointing it at a repository (`rev-parse --local-env-vars`), asked from `dir` once a
// process: the list is git's own, the same from any folder. Throws as git does; a failure is not kept.
export function findLocalGitVariables(dir) {
  keptLocalVariables ??= git(["rev-parse", "--local-env-vars"], dir).split(/\s+/);
  return keptLocalVariables;
}

// The files the index of the worktree at `root` tracks, from the index's header: git names the index, whose first
// INDEX_HEADER bytes are `DIRC`, a version from 2 to 4 and the count. Null when git names none or the header does not
// read.
export function trackedFiles(root) {
  const head = Buffer.alloc(INDEX_HEADER);
  let fd = null;
  try {
    fd = openSync(findGitPath(root, "index"), "r");
    if (readSync(fd, head, 0, INDEX_HEADER, 0) < INDEX_HEADER) return null;
  } catch { return null; } finally { if (fd !== null) closeSync(fd); }
  const version = head.readUInt32BE(4);
  const gitsOwn = head.toString("latin1", 0, 4) === "DIRC" && version >= 2 && version <= 4;
  return gitsOwn ? head.readUInt32BE(8) : null;
}

// The main checkout of the repository at `root` (itself, when `root` is one), or null: no git, or a git directory not
// named `.git`.
export function mainCheckout(root) {
  let common;
  try { common = findGitPath(root, "common"); } catch { return null; }
  return basename(common) === ".git" ? dirname(common) : null;
}
