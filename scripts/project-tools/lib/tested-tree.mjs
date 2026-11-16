// @level infrastructure
// Roadkeeper — the tested tree: the hash of the tree `git add -A` and a commit would make of the worktree, the tree a run
// tests. Asks git only, through git's own content filters and ignore rules; writes nothing under .git: the index is
// copied into a temporary folder, and the objects git writes go there too, beside a read of the repository's own. Each
// git call over the worktree's files is bounded at git's own bound and LAYOUT_PER_FILE a file its index tracks.

import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { GIT_TIMEOUT, git, gitWithin, trackedFiles } from "../../_git.mjs";
import { limitFor } from "../../_time-limit.mjs";
import { LAYOUT_PER_FILE } from "./commit-tree.mjs";

// The absolute path of a file or folder git keeps for the worktree at `root`.
const gitPath = (root, name) => resolve(root, git(["rev-parse", "--git-path", name], root));

// The bound of each git call making the tested tree of the worktree at `root`: git's own bound and LAYOUT_PER_FILE a
// file its index tracks, `git add -A` the call it was measured on.
export const testedTreeLimit = (root) => limitFor({ floor: GIT_TIMEOUT, perFile: LAYOUT_PER_FILE }, trackedFiles(root));

// The tested tree's hash of the worktree at `root`, its install folder `install` (null: none) left out, as a linked one
// is not the project's; null when git cannot say.
export function testedTree(root, install) {
  const temporary = mkdtempSync(join(tmpdir(), "roadkeeper-tree-"));
  try {
    const index = join(temporary, "index");
    try { copyFileSync(gitPath(root, "index"), index); } catch (e) { if (e.code !== "ENOENT") throw e; } // none: git starts one
    mkdirSync(join(temporary, "objects"));
    const own = { GIT_INDEX_FILE: index, GIT_OBJECT_DIRECTORY: join(temporary, "objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: gitPath(root, "objects") };
    const call = { own, timeout: testedTreeLimit(root) };
    gitWithin(["add", "-A"], root, call);
    // taken out after the add: an exclude pathspec naming an ignored path fails it, and an ignore rule ending in `/`
    // misses a link where git reads it as a file
    if (install) gitWithin(["rm", "--cached", "-r", "-q", "--ignore-unmatch", "--", install], root, call);
    return gitWithin(["write-tree"], root, call);
  } catch {
    return null;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
