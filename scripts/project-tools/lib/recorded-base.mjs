// @level infrastructure
// Roadkeeper — the recorded base: which of same-cases' base suites are read from their suite records (suite-records.mjs)
// in place of running, and which run. A suite reads the record of the base's own tree; where the project records its
// edges (structure.json, read in the base's tree), also the newest record of a tree differing from the base in no file
// the suite reaches (reader-scan.mjs's readersThrough, as reader-tests reads a change's readers; near-stamp.mjs's
// changedFiles, a tree git does not hold passed over). Reads git, the base's tree and the clone's suite records; a
// record found that does not read is said, and its suite runs; records that cannot be read at all are said once, and
// every suite runs.

import { shortHash } from "../../_git.mjs";
import { shownName } from "./commit-tree.mjs";
import { changedFiles } from "./near-stamp.mjs";
import { readersThrough } from "./reader-scan.mjs";
import { findRecordsRefusal, listRecordedTrees, readSuiteRecord } from "./suite-records.mjs";

// The suites of `base` that nothing changed between the tree `other` and the base's tree reaches; none when git cannot
// say. `base`: splitRecordedBase's.
function findUntouchedSuites(base, other) {
  const { root, tree, tests, suites, reach } = base;
  const changed = changedFiles(root, other, tree);
  if (changed === null) return new Set();
  const { edges, runLists } = reach;
  const reached = new Set(readersThrough({ root: reach.tree, tests, changed, edges, runLists }).readers.map((r) => r.file));
  return new Set(suites.filter((s) => !reached.has(s)));
}

// The trees whose suite records may stand for the base's suites, the base's own first: the others only where the
// project records its edges: { trees, isUntouched }, `isUntouched(t, suite)` whether nothing the tree `t` changed
// against the base reaches the suite, each tree's untouched suites (findUntouchedSuites) worked out once, when first
// asked.
function listCandidateTrees(base) {
  const others = base.reach.edges ? listRecordedTrees(base.main).filter((t) => t !== base.tree) : [];
  const untouched = new Map();
  const isUntouched = (t, suite) => {
    if (t === base.tree) return true;
    if (!untouched.has(t)) untouched.set(t, findUntouchedSuites(base, t));
    return untouched.get(t).has(suite);
  };
  return { trees: [base.tree, ...others], isUntouched };
}

// The record standing for `suite`: { tree, record }, its record of the first candidate tree holding one whose changes
// it does not reach, or of that tree a record that does not read; null when none.
function findStandingRecord(base, candidates, suite) {
  for (const t of candidates.trees) {
    const record = readSuiteRecord(base.main, t, suite);
    if (record && candidates.isUntouched(t, suite)) return { tree: t, record };
  }
  return null;
}

// The base's suites split by the suite records in its main checkout: { read, run, lines }, `read` the cases read from
// records, `run` the suites to run, `lines` a line for each suite read or whose record does not read, led by `label`.
// `base`: { root, main, tree, tests, suites, reach }, the worktree's root, its main checkout, the base's tree, the
// base's test files and the suites to run there, `reach` { tree, edges, runLists }, the base laid out, the edges its
// structure.json records (null: none) and its declared run lists.
export function splitRecordedBase(base, label) {
  const refused = findRecordsRefusal(base.main);
  if (refused) return { read: [], run: base.suites, lines: [`${label}: suite records not read: ${refused}`] };
  const candidates = listCandidateTrees(base);
  const read = [], run = [], lines = [];
  for (const suite of base.suites) {
    const found = findStandingRecord(base, candidates, suite);
    const recorded = found ? `its suite record of ${shortHash(found.tree)}` : "";
    if (found?.record.cases) {
      read.push(...found.record.cases);
      lines.push(`${label}: ${shownName(suite)} read from ${recorded} (${found.record.date})`);
      continue;
    }
    if (found) lines.push(`${label}: ${shownName(suite)} not read from ${recorded}: ${found.record.unread}; run`);
    run.push(suite);
  }
  return { read, run, lines };
}
