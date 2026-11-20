#!/usr/bin/env node
// @level main
// Roadkeeper — the retro's table of a slice's runs: one row a run, the session and each agent, with its calls and its
// seconds, split into waiting on you (a session's from its last reply, the owner's own message before or a question
// box's answer, the latest, to each message the owner typed, and from each question box to its answer; an agent's from its hand-back to the session's
// message resuming it) and the rest, its greens with their seconds and outcomes, its test runs
// (reader-tests --run, red-before, same-cases, or a test file run by name with the commands file's `runTests`
// program and `tests` pattern) counted with their seconds and any with no end, its hook
// refusals (GLOSSARY.md) and lint fixes by hook, and its failed calls by kind (exited non-zero, denied, tool errors,
// repeated), read from the transcripts Claude Code keeps for the project, cut to the slice window (GLOSSARY.md); under
// the table, each green with the slowest test files it printed.
//   node slice-runs.mjs <N> [--root <path>]                          the spec's slice window, from the tracker
//   node slice-runs.mjs <N> --from <time> [--to <time>] [--root <path>]   a window given by hand, for work never labelled
//
// Acts on the tree --root names, else the directory it is run in (scripts/_root-option.mjs).
// Reads: the tracker, through scripts/_tracker.mjs and its `gh` rule; the tree's commands file, a plain file with no
// link on the way, up to 1 MB, a file that is no JSON stopping the command; and, outside the tree, only Claude Code's
// transcript folder for the project (under CLAUDE_CONFIG_DIR, else ~/.claude), read-only, as plain files with no link
// on the way from the config folder, and the output file a background green's task notification there names, read-only,
// an absolute `….output` path to a plain file under the OS temp folder with no link on the way from it
// (CODING_STANDARDS.md's Security).
// Refuses: the transcript folder reached through a link stops the command; a link inside it is not read; a
// transcript last written before the window starts is never opened; at most 5,000 transcripts are read; a line over
// 64 MB is skipped unparsed; an output file outside the temp folder, a link, not a file or over 16 MB reads "times not
// found"; a run's name is cut to 80 characters, a line listing greens to 200. The table says what any bound cut, and
// each link, unreadable transcript or description file, subagents folder it could not list and unparsed line it
// skipped. A transcript folder it cannot list, or a window holding no message or call, stops the command, no table
// written.
// The cap it was made for: Roadkeeper's own transcript folder, 4.49 GB in 2,097 transcripts, one of them 1.77 GB. On
// a slice window of 2026-11-19, from its tracker labels, its tracker reads included, timed whole by PowerShell's
// Measure-Command: idle (CPU 6% before the run, 2 node processes running), 8.0 s first and 5.8 s run again;
// under load (a review agent's run, with other review agents running beside it), 22.3 s.
// Writes: the table into .run/retro-<N>/slice-runs.md under the tree, whole, and prints it.

import { basename, join } from "node:path";
import { insideRoot, readPlainFile, recordsDir, replaceFile } from "./_files.mjs";
import { rootOption } from "./_root-option.mjs";
import { buildSliceRunsTable, readSliceWindow } from "./slice-runs/slice-runs.mjs";
import { globMatch } from "./structure/structure.mjs";

const COMMANDS_FILE = "docs/roadkeeper/commands.json"; // the project's commands file, read for how it runs its tests
const COMMANDS_CAP = 1024 * 1024; // bytes of the commands file read: a project's is a few KB

// what --help prints
const USAGE = `usage: node slice-runs.mjs <N> [--from <time> [--to <time>]] [--root <path>]
  <N>            the spec's number: the window runs from the active label of the issue specced in it, or of the
                 spec, to the next issue's active label, or now
  --from, --to   the window given by hand, for work never labelled active; --to defaults to now
  --root         the project's tree, else the working directory
Prints the table and writes it into .run/retro-<N>/slice-runs.md.
`;

const fail = (line) => { process.stderr.write(line + "\n"); process.exit(1); };

// a time given by hand, in milliseconds, or the command stops
const parseTimeOrStop = (text, option) => {
  const time = Date.parse(text || "");
  if (Number.isNaN(time)) fail(`slice-runs.mjs: ${option} needs a time, such as 2026-11-19T13:40:00Z`);
  return time;
};

// the retro's number and the window the arguments give
function parseArgs(argv) {
  const given = { number: null, from: null, to: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") given.from = parseTimeOrStop(argv[++i], "--from");
    else if (a === "--to") given.to = parseTimeOrStop(argv[++i], "--to");
    else if (/^\d{1,9}$/.test(a) && given.number === null) given.number = Number(a);
    else fail(`slice-runs.mjs: unknown argument ${a}`);
  }
  if (given.number === null) fail("slice-runs.mjs: name the spec's number");
  return given;
}

// the window the times given by hand name, else the spec's slice window read from the tracker
function chooseWindow(root, given) {
  const now = Date.now();
  if (given.from !== null) return { from: given.from, to: given.to ?? now, said: "given by hand" };
  if (given.to !== null) fail("slice-runs.mjs: --to needs --from");
  const read = readSliceWindow(root, given.number, now);
  if (read.refused) fail(`slice-runs.mjs: ${read.refused} — no table written.`);
  return read.window;
}

// the commands file's text parsed, or the command stops
function parseCommandsOrStop(text) {
  try { return JSON.parse(text); } catch { return fail(`slice-runs.mjs: ${COMMANDS_FILE} is no JSON — no table written.`); }
}

// How the project runs a test file, from its commands file under the root, a plain file with no link on the way:
// { program, isTestFile }, program its `runTests` program's name, null when it names no `tests` pattern or program,
// and whether a path from the root matches its `tests` pattern.
function readTestCommand(root) {
  const dir = recordsDir(root);
  const text = dir === null ? null : readPlainFile(join(dir, "commands.json"), COMMANDS_CAP);
  const commands = text === null ? {} : parseCommandsOrStop(text);
  const pattern = typeof commands.tests === "string" ? commands.tests : null;
  const runTests = Array.isArray(commands.runTests) ? commands.runTests : [];
  const hasProgram = pattern !== null && typeof runTests[0] === "string";
  return { program: hasProgram ? basename(runTests[0]).replace(/\.exe$/, "") : null,
    isTestFile: (path) => pattern !== null && globMatch(pattern, path) };
}

function main() {
  if (process.argv.slice(2).includes("--help")) { process.stdout.write(USAGE); return; }
  const { root, rest, refused } = rootOption(process.argv.slice(2));
  if (refused) fail("slice-runs.mjs: --root must name a directory — no table written.");
  const given = parseArgs(rest);
  const window = chooseWindow(root, given);
  const testCommand = readTestCommand(root);
  const { table, refused: why } = buildSliceRunsTable(root, { number: given.number, window, testCommand }, process.env);
  if (why) fail(`slice-runs.mjs: ${why} — no table written.`);
  const out = join(root, ".run", `retro-${given.number}`, "slice-runs.md");
  if (!insideRoot(root, out)) fail(`slice-runs.mjs: ${out} is not a plain path inside the tree — no table written.`);
  replaceFile(out, table + "\n");
  process.stdout.write(`${table}\n\nslice-runs.mjs: written to ${out}\n`);
}

main();
