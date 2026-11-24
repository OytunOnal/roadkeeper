// @level presentation
// Roadkeeper — the check at write's refusal's lines, built whole from a judgement (written-file-judgement.mjs) in fixed
// words, never the linter's message: each breach `src/route.ts:88 max-lines-per-function 52 > 40`, a rule with no
// numbers `refused`, a rule id of an unknown shape `rule`; the file's and each record's path shown as the file's is,
// control characters replaced, cut to a cap, a row's path never. The steps first, when there are any (a syntax error,
// said once at its first line; a re-key of rows under a path gone), then the breaches' lines, then the cause's, then a
// rule past its record's count. Each line but a breach's starts with the hook's name, through the `message` the
// module's entry hands in; the causes an adapter names are the entry's too.

import { basename } from "node:path";
import { controlsReplaced, cutAt, plural } from "../../../_text.mjs";
import { isRuleId, showLineNumber } from "./written-file-judgement.mjs";

const LINES_SHOWN = 20;            // breaches said one by one; the rest counted
const PATH_SHOWN = 300;            // characters of the file's path shown

// a path or a name from the project made fit to show in a line: control characters replaced, cut to PATH_SHOWN
const cleanForLine = (p) => cutAt(controlsReplaced(p), PATH_SHOWN);
const isNumbers = (n) => Array.isArray(n) && n.length === 2 && n.every((x) => Number.isSafeInteger(x) && x >= 0);

// The builders of the refusal's lines that start with the hook's name, each line said through `message`, the entry's.
const buildLineBuilders = (message) => Object.freeze({
  // the refusal's first line
  refused: () => message("the project's linter refuses the file written; fix each line:"),
  // The refusal of a run that did not pass with no breach read: how it ended, and the command that says the rest.
  failed: ({ why, path }) => message(`the project's lintFile did not pass (${why}), and no breach `
    + `could be read from its output; run the commands file's lintFile on ${path} to read the rest`),
  // the refusal of a passed run no breach can be read from
  unread: () => message("the project's lintFile ran, but its output could not be read; "
    + "fix the linter or the commands file's lintFile"),
  // the over-counted refusal when no record holds a row for the file
  overCounted: () => message("a suppression record counts more breaches of a rule in this file than "
    + "it has now; lower it with the linter's `--prune-suppressions`"),
  // The refusal of a run whose suppression record at `record`, holding rows for the file, counts more breaches than the
  // file has: how to lower it.
  recordOverCounted: (record) => message(`the suppression record \`${record}\` counts more breaches in `
    + "this file than it has now; lower it with the linter's `--prune-suppressions`"),
  // The refusal of a run ESLint stopped on an error of its own: how it ended when it did not pass, where the error lies,
  // and the command that shows it.
  eslintStopped: ({ why, path }) => message(`ESLint stopped on an error of its own${why ? ` (${why})` : ""} `
    + "before judging the file: its config, a plugin, or a file the config imports; run the commands file's lintFile on "
    + `${path} to read it`),
  // What a suppression record says of a rule past the count it allows the written file.
  pastCount: ({ record, rule, allowed, now }) => message(`the suppression record \`${record}\` `
    + `allows ${allowed} \`${rule}\` in this file; it now has ${now}`),
  // The step opening a refusal of the file shown at `path` when a suppression record holds rows for a file of the
  // written file's name under a path gone: to re-key them, the breaches below perhaps theirs.
  reKey: ({ record, name }, path) => message(`re-key the rows the suppression record \`${record}\` `
    + `holds for \`${name}\` at a path that no longer exists to \`${path}\`; the lines below may be those rows' breaches`),
  // The step opening a refusal of the file shown at `path` that does not parse at line `line`.
  syntax: (path, line) => message(`${path} does not parse at line ${line}: fix its syntax there; `
    + "the linter judges nothing else until it does"),
});

// each cause an adapter names (`causes`, adapters.mjs's), its refusal's lines for a judgement, built by `build`
// (buildLineBuilders'): over-counted, one per record holding rows for the file
const buildCauseLines = (causes, build) => new Map([[causes.failed, (judged) => [build.failed(judged)]],
  [causes.unread, () => [build.unread()]],
  [causes.overCounted, ({ holdingRecords }) => (holdingRecords.length
    ? holdingRecords.map((record) => build.recordOverCounted(record)) : [build.overCounted()])],
  [causes.eslintStopped, (judged) => [build.eslintStopped(judged)]]]);

// A breach's line, built from its numbers and fixed words alone.
function breachLine(path, { line, rule, numbers }) {
  const id = isRuleId(rule) ? rule : "rule";
  return `${path}:${showLineNumber(line)} ${id} ${isNumbers(numbers) ? `${numbers[0]} > ${numbers[1]}` : "refused"}`;
}

// The refusal's lines for these breaches of the file shown at `path`: LINES_SHOWN said one by one, the rest counted.
function buildBreachLines(path, breaches) {
  const lines = breaches.slice(0, LINES_SHOWN).map((b) => breachLine(path, b));
  const more = breaches.length - lines.length;
  return more > 0 ? [...lines, `and ${plural(more, "breach", "breaches")} more`] : lines;
}

// What a judgement's suppression records say, each record's path and the file's name shown as the file's path is:
// { holdingRecords, pastCounts, movedRows }, `movedRows` each { record, name }.
const shownNotes = ({ path, holdingRecords, pastCounts, movedRows }) => ({
  holdingRecords: holdingRecords.map(cleanForLine),
  pastCounts: pastCounts.map((n) => ({ ...n, record: cleanForLine(n.record) })),
  movedRows: movedRows.map((n) => ({ record: cleanForLine(n.record), name: cleanForLine(basename(path)) })) });

// The steps a refusal opens with, built by `build`: the syntax error's, then a re-key per record holding moved rows;
// none when neither is found.
const buildStepLines = (build, { path, syntaxLine, movedRows }) => [
  ...(syntaxLine ? [build.syntax(path, syntaxLine)] : []),
  ...movedRows.map((n) => build.reKey(n, path))];

// The refusal's lines for a judgement (written-file-judgement.mjs's judgeWrittenFile) that does not pass: the
// install's line alone; else its steps (buildStepLines), or the hook's own line when it has none and there is a breach;
// the breaches' lines; the cause's line; then the counts past what a suppression record allows. The entry's words:
// { message, causes }, `message(words)` a line of the hook's, `causes` the causes an adapter names. A cause with no line throws,
// naming it.
export function refusalLines(judged, { message, causes }) {
  if (judged.said) return [message(judged.said)];
  const build = buildLineBuilders(message);
  const path = cleanForLine(judged.path);
  const notes = shownNotes(judged);
  const lines = buildBreachLines(path, judged.breaches);
  const steps = buildStepLines(build, { path, syntaxLine: judged.syntaxLine, movedRows: notes.movedRows });
  const saysOwnLine = !steps.length && lines.length > 0; // breaches with no step to open with
  const opening = saysOwnLine ? [build.refused()] : steps;
  const causeLines = judged.cause ? buildCauseLines(causes, build).get(judged.cause) : () => [];
  if (!causeLines) throw new Error(`check-at-write: no refusal line for the adapter's cause ${judged.cause}`);
  const causeSaid = causeLines({ why: judged.why, path, holdingRecords: notes.holdingRecords });
  return [...opening, ...lines, ...causeSaid, ...notes.pastCounts.map((n) => build.pastCount(n))];
}
