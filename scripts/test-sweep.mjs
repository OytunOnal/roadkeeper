#!/usr/bin/env node
// @level main
// Roadkeeper — the test sweep's page, at a milestone close: `node <roadkeeper>/scripts/test-sweep.mjs [--root <path>]
// <cards file>`.
//
// Acts on the root of the worktree holding --root's folder, else the directory it is run in (scripts/_root-option.mjs).
// Reads the cards file, the test-readers' cards in the format --help prints (CARDS_FORMAT, written from
// scripts/test-sweep/lib/cards-file.mjs's fields, kinds and caps), and the commands file. Checks
// the cards against that format; runs every test file of the suite once whole by the commands file's `runTests`, side
// by side, then each test file a card names by its `runCases` without the cards' cases (scripts/project-tools/), each
// run under Node's coverage (NODE_V8_COVERAGE), which every node process the run starts writes, and Python's
// `coverage` from the Python the run starts, the project's own install: a `sitecustomize.py` first on PYTHONPATH starts
// it in every Python process; names on each card the lines of the project's code only its cases reached in the whole
// suite, a line counted only when every character on it ran, the test files, the folders holding them, the install,
// installed packages and .run/ aside (scripts/test-sweep/). A card whose run's Python could not start `coverage` says its Python code was
// not read for coverage. A commands file with no `runCases` runs no test file: each card says it was not read for
// coverage, naming `runCases` to add.
// Writes under the root's .run/ only: the runs' data, removed once the page is drawn or the sweep stops, and the page,
// .run/test-sweep/cards.html, self-contained, its path printed.
// A relative cards file is read from --root's folder, else the working directory.
// Refuses, each with a first line naming the fix, exit 1, no page drawn: a cards file outside the root, behind a link,
// over 1 MB or off the format; a card naming a file no test pattern matches, no plain file in the project, a file
// behind a link or one whose path holds a part starting with `-`, or a case its file's run did not read; a linked page
// or runs folder; a commands file whose `runCases` ran a case it was to leave out.
// Not measured: a Python process started with `-S`, `-I` or `-E`, which skips the start file, or ending through
// `os._exit`, which skips its write; a card whose Python ran only there may say no line only its cases reached. A usage slip prints the usage, exit 2; --help prints it
// and the format, exit 0.

import { rootOption } from "./_root-option.mjs";
import { CARDS_FORMAT, writeSweepPage } from "./test-sweep/test-sweep.mjs";

const USAGE = "usage: node test-sweep.mjs [--root <path>] <cards file>"; // printed on --help and a usage slip
const say = (line) => { process.stdout.write(line + "\n"); };

const { root, rest, refused } = rootOption(process.argv.slice(2));
const isSlip = refused || rest.length !== 1 || rest[0].startsWith("-");
if (rest.includes("--help")) { say(USAGE); say(CARDS_FORMAT); }
else if (isSlip) { say(USAGE); process.exitCode = 2; }
else process.exitCode = await writeSweepPage({ dir: root, cardsFile: rest[0] }, say);
