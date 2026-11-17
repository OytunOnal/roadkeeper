// @level infrastructure
// Roadkeeper — the check at write: a file just written judged by its project's `lintFile`, run from the root of the worktree
// holding it (command-run.mjs), the main checkout's install linked in when a linked worktree has none and pins what
// the main checkout pins (worktree.mjs), else the linter not run and that said; `{file}`, in any of its arguments, the
// file's path from that root. The stack's adapter reads the breaches from the run's output, its unused names left to
// the commit, and names a cause when none is read or ESLint's own sentence names one beside them, given back with the
// run's `why`, how it ended (command-run.mjs); each breach becomes a line built here, never the linter's message:
// `src/route.ts:88 max-lines-per-function 52 > 40`, a rule with no numbers `refused`, a rule id of an unknown shape
// `rule`. Beside a refusal, what the project's suppression records say of the file (suppression-records.mjs): the
// records holding rows for it, a rule past the count a record allows, or rows for a file of its name under a path gone; a record's path shown as the file's
// is, control characters replaced, cut to a cap, a row's path never. Judges nothing: a file outside the session's project, the clone holding the folder the caller names, its
// linked worktrees included (a repository nested in it or elsewhere is a stranger's, whose `lintFile` never runs); a
// file in no git worktree or no Roadkeeper project, a commands file missing or malformed or with no `lintFile`, or one with
// no `{file}`, a file git ignores, a path from the root starting with `-`.

import { basename, dirname } from "node:path";
import { pathFrom } from "../../_files.mjs";
import { git } from "../../_git.mjs";
import { controlsReplaced, cutAt, plural } from "../../_text.mjs";
import { adapterOf } from "../adapters/adapters.mjs";
import { commandEnv, runCommandWithin } from "./command-run.mjs";
import { readCommands } from "./commands-file.mjs";
import { findRecordNotes, readSuppressionRecords } from "./suppression-records.mjs";
import { sameClone, worktreeInstall, worktreeRoot } from "./worktree.mjs";

const FILE = "{file}";             // lintFile's text the written file's path takes the place of
const LINT_TIMEOUT = 75 * 1000;    // milliseconds the linter may take: under the hook's 90 s, so the hook ends it
const LINES_SHOWN = 20;            // breaches said one by one; the rest counted
const PATH_SHOWN = 300;            // characters of the file's path shown
const RULE_SHOWN = 100;            // characters of a rule id shown; a longer one reads as of an unknown shape
const RULE_ID = /^(?:@[\w.-]+\/)?[A-Za-z][\w.-]*(?:\/[A-Za-z][\w.-]*)*$/; // `max-params`, `roadkeeper/named-condition`, `@scope/rule`

// The written file's path from the root of the worktree holding it, with `/`: { root, path }, or null outside one.
function placed(file) {
  const root = worktreeRoot(dirname(file));
  const path = root && pathFrom(root, file);
  return path ? { root, path } : null;
}

// whether git ignores the path at the root: run output and scratch, not the project's code
function ignored(root, path) {
  try { git(["check-ignore", "-q", "--", path], root); return true; } catch { return false; }
}

// a path or a name from the project made fit to show in a line: control characters replaced, cut to PATH_SHOWN
const cleanForLine = (p) => cutAt(controlsReplaced(p), PATH_SHOWN);
const isNumbers = (n) => Array.isArray(n) && n.length === 2 && n.every((x) => Number.isSafeInteger(x) && x >= 0);
const isRuleId = (rule) => typeof rule === "string" && rule.length <= RULE_SHOWN && RULE_ID.test(rule);

// A breach's line, built from its numbers and fixed words alone.
function breachLine(path, { line, rule, numbers }) {
  const at = Number.isSafeInteger(line) && line > 0 ? line : 1;
  const id = isRuleId(rule) ? rule : "rule";
  return `${path}:${at} ${id} ${isNumbers(numbers) ? `${numbers[0]} > ${numbers[1]}` : "refused"}`;
}

// The lint run's read for the written file: its adapter's { breaches } or { cause }, with the run's `why`, how a run
// that did not pass ended; or { said }, the line saying why no main checkout's install is linked, the linter not run. `run`: { root, path, commands }.
async function linted({ root, path, commands }) {
  const adapter = adapterOf(commands.stack);
  const { said } = worktreeInstall(root, commands.install);
  if (said) return { said };
  const argv = commands.lintFile.map((a) => a.replaceAll(FILE, path));
  const ran = await runCommandWithin(argv, { cwd: root, env: commandEnv(root), timeout: LINT_TIMEOUT });
  return { ...adapter.breaches({ file: path, output: ran.tail, passed: ran.passed }), why: ran.why };
}

// The refusal's lines for these breaches of the file shown at `path`: LINES_SHOWN said one by one, the rest counted.
function buildBreachLines(path, breaches) {
  const lines = breaches.slice(0, LINES_SHOWN).map((b) => breachLine(path, b));
  const more = breaches.length - lines.length;
  return more > 0 ? [...lines, `and ${plural(more, "breach", "breaches")} more`] : lines;
}

// What the project's suppression records (suppression-records.mjs) say beside the refusal of the written file `at`
// with these breaches, each record's path and the file's name shown as the file's path is: { holdingRecords,
// pastCounts, movedRows }, `holdingRecords` the path of each record with a row for the file; `pastCounts` each
// { record, rule, allowed, now } for a rule past the count a record allows, its breaches with a rule id counted;
// `movedRows` each { record, name } for a record holding rows for a file of its name under a path gone.
function showRecordNotes({ root, path }, commands, breaches) {
  const counts = new Map();
  for (const { rule } of breaches) if (isRuleId(rule)) counts.set(rule, (counts.get(rule) ?? 0) + 1);
  const notes = findRecordNotes(root, readSuppressionRecords(root, commands), { path, counts });
  const name = cleanForLine(basename(path));
  return { holdingRecords: notes.holdingRecords.map(cleanForLine),
    pastCounts: notes.pastCounts.map((n) => ({ ...n, record: cleanForLine(n.record) })),
    movedRows: notes.movedRows.map((n) => ({ record: cleanForLine(n.record), name })) };
}

// The judgement of the file just written at `file`, an absolute path, in the session whose project holds the folder
// `project`: a promise of { lines }, the refusal's lines, none when it passes or is not judged; a refusal's with
// { path, holdingRecords, pastCounts, movedRows } beside them, the file's path as shown and what the suppression records say
// (showRecordNotes), and
// { cause, why } when the adapter names a cause (adapters.mjs), the lines none when no breach could be read: the cause
// and how the run ended; or { said }, the line saying where to install (worktree.mjs).
export async function writtenFileBreaches(file, project) {
  const at = placed(file);
  const ours = at && !at.path.startsWith("-") && sameClone(at.root, project);
  if (!ours) return { lines: [] };
  const { commands } = readCommands(at.root);
  const judged = commands?.lintFile?.some((a) => a.includes(FILE)) && !ignored(at.root, at.path);
  if (!judged) return { lines: [] };
  const { breaches = [], cause, why, said } = await linted({ ...at, commands });
  if (said) return { said };
  const path = cleanForLine(at.path);
  const lines = buildBreachLines(path, breaches);
  if (!lines.length && !cause) return { lines };
  const refused = { lines, path, ...showRecordNotes(at, commands, breaches) };
  return cause ? { ...refused, cause, why } : refused;
}
