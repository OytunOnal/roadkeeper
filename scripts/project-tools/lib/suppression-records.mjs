// @level infrastructure
// Roadkeeper — a project's suppression records read for the check at write, and what they say of a file refused: a rule
// past the count a record allows it, or rows for a file of its name under a path gone. A record is ESLint's bulk
// suppressions record, `{ path: { rule: { count } } }`, found as ESLint finds it (the commands file's `lintFile`'s
// `--suppressions-location <path>` or `--suppressions-location=<path>`, else eslint-suppressions.json at the root), and
// each the commands file's `suppressionRecords` lists.
//
// Boundary: a record is a stranger's text. It is read only inside the project's root, as a plain file with no link on
// the way, under its cap, its rows and each row's rules under theirs; checked against ESLint's shape whole, its keys held
// in Maps, so no key reaches a prototype; only its paths and counts are kept. A record missing, unreadable, a link,
// outside the root, over a cap or of another shape is passed over, saying nothing. A row's path is only compared and
// tested for existence, only once it leads inside the root with no link on the way, never given back; a record's own path is given back from the root, for its caller to show as
// the written file's path is shown.

import { join, resolve } from "node:path";
import { insideRoot, lexists, noLinkOnTheWay, pathFrom, readPlainFile } from "../../_files.mjs";
import { isObject, isPathFromRoot } from "./json-shapes.mjs";

const DEFAULT_RECORD = "eslint-suppressions.json"; // ESLint's own record, at the root it runs from
const LOCATION_OPTION = "--suppressions-location"; // lintFile's option naming ESLint's record
const CAP = 1024 * 1024;                           // bytes of one record: thousands of rows
const MAX_ROWS = 10000;                            // files one record holds rows for
const MAX_RULES = 100;                             // rules one row counts

const isCount = (held) => isObject(held) && Object.hasOwn(held, "count") && Number.isSafeInteger(held.count) && held.count >= 0;
const takeFileName = (p) => p.slice(p.lastIndexOf("/") + 1);
// whether a row's rules, [rule, held] each, are under their cap and each holds its count
const areCountedRules = (rules) => rules.length <= MAX_RULES && rules.every(([, held]) => isCount(held));

// The record lintFile names: its --suppressions-location's value, else ESLint's default; undefined when the option ends
// the command.
function findLintFileRecord(lintFile) {
  const at = lintFile.indexOf(LOCATION_OPTION);
  if (at >= 0) return lintFile[at + 1];
  const joined = lintFile.find((a) => a.startsWith(`${LOCATION_OPTION}=`));
  return joined === undefined ? DEFAULT_RECORD : joined.slice(LOCATION_OPTION.length + 1);
}

// A parsed record's rows, path -> (rule -> count), or null when it is not of ESLint's shape or over a cap.
function readRows(parsed) {
  if (!isObject(parsed)) return null;
  const entries = Object.entries(parsed);
  if (entries.length > MAX_ROWS) return null;
  const rows = new Map();
  for (const [file, row] of entries) {
    if (!isObject(row)) return null;
    const rules = Object.entries(row);
    if (!areCountedRules(rules)) return null;
    rows.set(file, new Map(rules.map(([rule, held]) => [rule, held.count])));
  }
  return rows;
}

// The record at `named`, from the root or absolute: { path, rows }, its path from the root with `/`; null when the
// boundary passes it over.
function readRecord(root, named) {
  const file = resolve(root, named);
  const path = insideRoot(root, file) && pathFrom(root, file);
  const text = path && readPlainFile(file, CAP);
  if (!text) return null;
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  const rows = readRows(parsed);
  return rows && { path, rows };
}

// The suppression records of the project at `root` whose `commands` (commands-file.mjs's) are given: each { path, rows },
// once, lintFile's first.
export function readSuppressionRecords(root, commands) {
  const named = [findLintFileRecord(commands.lintFile ?? []), ...(commands.suppressionRecords ?? [])];
  const records = new Map();
  for (const location of named) {
    const record = typeof location === "string" && location !== "" && readRecord(root, location);
    if (record && !records.has(record.path)) records.set(record.path, record);
  }
  return [...records.values()];
}

// Whether a row's path, ESLint's key from the root with `/`, leads inside the root at `root` with no link on the way
// and nothing lies there. The links are looked for by lstat first, so nothing resolves a path through one.
function isGoneInside(root, key) {
  const file = isPathFromRoot(key) && join(root, ...key.split("/"));
  return Boolean(file) && noLinkOnTheWay(root, file) && insideRoot(root, file) && !lexists(file);
}

// Whether `rows` hold a row for a file named as `path`'s under a path inside `root` where nothing lies.
const holdsMovedRows = (root, rows, path) => [...rows.keys()]
  .some((key) => takeFileName(key) === takeFileName(path) && isGoneInside(root, key));

// What `records` (readSuppressionRecords') say of the refused file at `path` from the root, its breaches counted by rule
// in `counts`: { holdingRecords, pastCounts, movedRows }. `holdingRecords`, the path of each record with a row for the
// file; `pastCounts`, per such record, each rule of it the file now has more breaches of than it allows,
// { record, rule, allowed, now }; `movedRows`, with no row for the file in any record, each record holding rows for a
// file of its name under a path where nothing lies, { record }. `record` is the record's path.
export function findRecordNotes(root, records, { path, counts }) {
  const own = records.filter((r) => r.rows.has(path));
  const movedRows = own.length ? [] : records.filter((r) => holdsMovedRows(root, r.rows, path)).map((r) => ({ record: r.path }));
  const pastCounts = own.flatMap((r) => [...r.rows.get(path)].filter(([rule, allowed]) => (counts.get(rule) ?? 0) > allowed)
    .map(([rule, allowed]) => ({ record: r.path, rule, allowed, now: counts.get(rule) })));
  return { holdingRecords: own.map((r) => r.path), pastCounts, movedRows };
}
