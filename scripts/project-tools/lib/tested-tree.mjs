// @level infrastructure
// Roadkeeper — the tested tree: the hash of the tree `git add -A` and a commit would make of the worktree, the tree a run
// tests. Asks git only, through git's own content filters and ignore rules; writes nothing under .git: the index is
// copied into a temporary folder, and the objects git writes go there too, beside a read of the repository's own.

import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { git } from "../../_git.mjs";

// The absolute path of a file or folder git keeps for the worktree at `root`.
const gitPath = (root, name) => resolve(root, git(["rev-parse", "--git-path", name], root));

// The tested tree's hash of the worktree at `root`, its install folder `install` (null: none) left out, as a linked one
// is not the project's; null when git cannot say.
export function testedTree(root, install) {
  const temporary = mkdtempSync(join(tmpdir(), "roadkeeper-tree-"));
  try {
    const index = join(temporary, "index");
    try { copyFileSync(gitPath(root, "index"), index); } catch (e) { if (e.code !== "ENOENT") throw e; } // none: git starts one
    mkdirSync(join(temporary, "objects"));
    const env = { GIT_INDEX_FILE: index, GIT_OBJECT_DIRECTORY: join(temporary, "objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: gitPath(root, "objects") };
    git(["add", "-A"], root, env);
    // taken out after the add: an exclude pathspec naming an ignored path fails it, and an ignore rule ending in `/`
    // misses a link where git reads it as a file
    if (install) git(["rm", "--cached", "-r", "-q", "--ignore-unmatch", "--", install], root, env);
    return git(["write-tree"], root, env);
  } catch {
    return null;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
