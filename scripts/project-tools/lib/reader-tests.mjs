// @level infrastructure
// Roadkeeper — reader-tests: a change's reader tests, the test files whose own text names a changed file's path or
// one of its exported names (reader-scan.mjs), listed sorted by path; with `--run`, run in place as the green's
// `{tests}` step runs them (test-run.mjs), ending on a line saying they are not the green. It writes no green stamp.
// The change: the files named, by their paths from the root, else the uncommitted ones, staged, unstaged and
// untracked, as git lists them.
// The test files: those the commands file's `tests`, else the adapter's, matches, none reached through a link.

import { isAbsolute } from "node:path";
import { plural } from "../../_text.mjs";
import { pathFromRoot, shownName, uncommittedFiles } from "./commit-tree.mjs";
import { readerScan } from "./reader-scan.mjs";
import { testSetup, testsStepPasses, worktreeTests } from "./test-run.mjs";

export const RUN = "--run"; // the option running the reader tests found
const LABEL = "reader-tests"; // the tool's lines start with it

// The path a name gives from the root `root`, `/`-separated (pathFromRoot); null when it leads outside the root, or is
// given absolute or from a drive, so no path from the root.
const pathInside = (root, name) => (isAbsolute(name) || /^[A-Za-z]:/.test(name) ? null : pathFromRoot(root, name));

// reader-tests of the worktree holding `dir`, `args` the command's arguments but --root (RUN and file names), each
// line handed to `say`: a promise of the exit code, 0 listed or run green, 1 when a run case failed, 2 refused.
// `matches(pattern, path)` the test-file pattern's reading.
export async function readerTests({ dir, args, matches }, say) {
  const names = args.filter((a) => a !== RUN);
  const setup = testSetup({ dir, matches });
  if (setup.refused) { say(`${LABEL}: ${setup.refused}`); return 2; }
  const paths = names.map((name) => pathInside(setup.root, name));
  const outside = names.find((n, k) => paths[k] === null);
  if (outside !== undefined) { say(`${LABEL}: ${shownName(outside)} is not a path inside the root`); return 2; }
  let changed;
  try { changed = names.length ? [...new Set(paths)] : uncommittedFiles(setup.root); }
  catch { say(`${LABEL}: git could not list the uncommitted changes`); return 2; }
  if (setup.said) say(`${LABEL}: ${setup.said}`);
  const scan = readerScan({ root: setup.root, tests: worktreeTests(setup), changed, byNames: true });
  for (const line of scan.said) say(`${LABEL}: ${line}`);
  const readers = scan.readers.map((r) => r.file).sort();
  for (const file of readers) say(shownName(file));
  say(`${LABEL}: ${plural(scan.read, "test file")} read, ${plural(readers.length, "reader")} found`);
  if (!args.includes(RUN)) return 0;
  const passes = !readers.length || await testsStepPasses(setup, say, readers);
  say(`${plural(readers.length, "reader test")} run; not the green`);
  return passes ? 0 : 1;
}
