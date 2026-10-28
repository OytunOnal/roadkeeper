// @level infrastructure
// Roadkeeper — a run's JUnit results file, the one `{out}` named, read as a plain file under its cap and scanned
// (junit.mjs): each testcase with its `file` made relative to the tree the run ran in, as it is written when it lies
// elsewhere, "" for none. The stacks that read JUnit share it.

import { isAbsolute } from "node:path";
import { pathFrom, readPlainFile } from "../../../_files.mjs";
import { junitCases } from "./junit.mjs";

const RESULTS_CAP = 64 * 1024 * 1024; // bytes of a results file read: thousands of cases, each failure's stack with them

const toSlashes = (p) => p.replace(/\\/g, "/");

// A testcase's `file` relative to the tree at `root`, or as it is written when it lies elsewhere; "" for none.
function makeTreeRelative(root, file) {
  if (!file || !isAbsolute(file)) return toSlashes(file);
  return pathFrom(root, file) ?? toSlashes(file);
}

// The testcases of the JUnit file at `results` a run in the tree at `root` wrote, each { suites, name, classname, file,
// outcome, detail }, its file from the tree's root; none when it wrote none.
export function readResultsCases({ root, results }) {
  const text = readPlainFile(results, RESULTS_CAP);
  if (text === null) return [];
  return junitCases(text).map((raw) => ({ ...raw, file: makeTreeRelative(root, raw.file) }));
}
