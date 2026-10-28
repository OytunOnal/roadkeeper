// @level infrastructure
// Roadkeeper — git and the PATH: a program found on the PATH's absolute folders, one pinned `git` call, a repository's main
// checkout, and the shape of a git object's full name. scripts/tools/_main_checkout.py holds the same main-checkout rule for the repository's tools.
//
// A program runs as separate arguments, never through a shell, found on the PATH's absolute folders alone: Windows runs
// a bare name from the current folder first, and a program in the project under check must never run. No `git` there
// reads as git failing.

import { execFileSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { basename, delimiter, dirname, isAbsolute, join } from "node:path";

const GIT_TIMEOUT = 10000;     // milliseconds one `git` call may take
const MAX_PATH_FOLDERS = 1000; // PATH folders looked in for a program
export const OBJECT_HASH = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/; // a full SHA-1 or SHA-256 object name, nothing else

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

// One git call in `cwd`, its output trimmed; throws when git is not on the PATH, fails or takes too long. The opened
// repository's config cannot turn it into a program: the keys that run one are pinned (`core.fsmonitor`,
// `core.hooksPath`, `log.showSignature`), the `GIT_*` variables that point git elsewhere (a hook's GIT_DIR) are dropped,
// and nothing is fetched. `own`, the caller's own variables, set after the drop (a temporary index, say).
export function git(args, cwd, own = {}) {
  const program = findProgram("git");
  if (!program) throw new Error("git is not on the PATH");
  const kept = Object.entries(process.env).filter(([k]) => !k.toUpperCase().startsWith("GIT_"));
  const env = Object.assign(Object.create(null), Object.fromEntries(kept), own, { GIT_NO_LAZY_FETCH: "1" });
  return execFileSync(program, ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/nonexistent",
    "-c", "log.showSignature=false", ...args], {
    cwd, encoding: "utf8", timeout: GIT_TIMEOUT, stdio: ["ignore", "pipe", "ignore"],
    env, windowsHide: true,
  }).trim();
}

// The main checkout of the repository at `root` (itself, when `root` is one), or null: no git, or a git directory not
// named `.git`.
export function mainCheckout(root) {
  let common;
  try { common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], root); } catch { return null; }
  return basename(common) === ".git" ? dirname(common) : null;
}
