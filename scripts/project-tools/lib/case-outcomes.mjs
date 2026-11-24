// @level domain
// Roadkeeper — test cases read by name: a crashed file's made unknown, and compared between two trees. A case is its
// file and its id; its outcomes are every outcome its id took in its file, in order, so a case run over several inputs
// compares as a list; an unknown case always differs. An id gone from one file and new in another, once among each
// tree's unmatched cases, is a moved case, compared across its files. Their lines are case-outcome-lines.mjs's.

export const UNKNOWN = "UNKNOWN"; // a crashed file's case's outcome: nothing proves it
export const OUTCOMES_WITH_DETAIL = new Set(["FAIL", "SKIP"]); // the outcomes whose detail shows under their case
const SEPARATOR = "\u0000"; // between a case's file and id in its key: no name read holds one
// the outcomes a changed case says why it took: those with a detail, and a crash's unknown
const OUTCOMES_WITH_REASON = new Set([...OUTCOMES_WITH_DETAIL, UNKNOWN]);

const order = new Intl.Collator("en", { numeric: true }).compare; // A2 before A10

// The crashed files of one run given `files`, each to its crash's first line; empty when the run did not crash. A
// failing case of no file given is a crash; it crashes each file the run read a case from whose path, `/` or `\`
// between its parts, its detail or text holds (an absolute path in the run's tree holds it too), or every file when it
// holds none. A file crashed twice keeps the first crash.
export function crashedFiles(cases, files) {
  const crashOf = new Map();
  const read = files.filter((f) => cases.some((c) => c.file === f));
  for (const crash of cases.filter((c) => c.outcome === "FAIL" && !files.includes(c.file))) {
    const crashText = `${crash.detail}\n${crash.text}`;
    const named = read.filter((f) => crashText.includes(f) || crashText.includes(f.replaceAll("/", "\\")));
    for (const file of named.length ? named : files) if (!crashOf.has(file)) crashOf.set(file, crash.detail.split("\n")[0]);
  }
  return crashOf;
}

// The cases, each of a file `crashOf` holds UNKNOWN, its detail that file's crash.
export const unknownMarked = (cases, crashOf) =>
  cases.map((c) => (crashOf.has(c.file) ? { ...c, outcome: UNKNOWN, detail: crashOf.get(c.file) } : c));

// Why a case took its outcome: a failing or unknown case's detail, a skipped case's reason; null for a pass.
function reasonOf(testCase) {
  if (!OUTCOMES_WITH_REASON.has(testCase.outcome)) return null;
  return testCase.outcome === "SKIP" ? testCase.skipReason : testCase.detail;
}

// Each case's runs by its key, each run its outcome and why it took it: { file, id, runs: [{ outcome, reason }] }.
function runsByCase(cases) {
  const found = new Map();
  for (const c of cases) {
    const key = c.file + SEPARATOR + c.id;
    if (!found.has(key)) found.set(key, { file: c.file, id: c.id, runs: [] });
    found.get(key).runs.push({ outcome: c.outcome, reason: reasonOf(c) });
  }
  return found;
}

// A case's outcomes on one tree (runsByCase's entry), in order.
export const outcomesOf = (entry) => entry.runs.map((run) => run.outcome);

// The ids among these unmatched cases that only one holds.
function once(unmatched) {
  const seen = new Map();
  for (const c of unmatched) seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
  return new Map(unmatched.filter((c) => seen.get(c.id) === 1).map((c) => [c.id, c]));
}

// Each moved case: the base's key to today's case.
function moves(base, today) {
  const gone = once([...base].filter(([k]) => !today.has(k)).map(([, c]) => c));
  const landed = once([...today].filter(([k]) => !base.has(k)).map(([, c]) => c));
  return new Map([...gone].filter(([id]) => landed.has(id)).map(([id, c]) => [c.file + SEPARATOR + id, landed.get(id)]));
}

const outcomesKey = (entry) => outcomesOf(entry).join(" ");

// Whether a case's outcomes differ between the base and today: an unknown one on either tree always does, since
// nothing proves it the same.
const differs = (was, now) =>
  outcomesKey(was) !== outcomesKey(now) || [...outcomesOf(was), ...outcomesOf(now)].includes(UNKNOWN);

// In one tree only: the case as the other tree holds it, with no run.
const markAbsent = (entry) => ({ ...entry, runs: [] });

// Each case whose outcomes differ between the base's cases and today's, as [was, now], each { file, id, runs }, `runs`
// each { outcome, reason } and none on a tree that does not hold it: in its outcomes, in one tree only, or in how often
// it ran, or unknown on either; file by file, id by id.
export function changedCases(baseCases, todayCases) {
  const base = runsByCase(baseCases), today = runsByCase(todayCases);
  const moved = moves(base, today);
  const landed = new Set([...moved.values()].map((c) => c.file + SEPARATOR + c.id));
  const keys = [...new Set([...base.keys(), ...today.keys()])].filter((k) => !landed.has(k));
  const cases = keys.map((k) => {
    const was = base.get(k) ?? markAbsent(today.get(k));
    return [was, moved.get(k) ?? today.get(k) ?? markAbsent(was)];
  });
  const sorted = cases.sort(([a], [b]) => order(a.file, b.file) || order(a.id, b.id));
  return sorted.filter(([was, now]) => differs(was, now));
}
