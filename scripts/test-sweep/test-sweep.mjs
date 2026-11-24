// @level main
// Roadkeeper — the test sweep's entry: the cards file checked (lib/cards-file.mjs), each carded test file run whole and
// without its cards' cases under the coverage readers (lib/sweep-runs.mjs), handed the project tools' runs and the
// run folders on disk (lib/open-run-folders.mjs), and the
// cards page drawn (lib/cards-page.mjs); with no `runCases` in the commands file, the page drawn with no run, each card
// saying it was not read for coverage. Reads the cards file only inside the project root, a plain file with no link
// on the way, under CARDS_CAP; runs a card's file only when it is a plain file there with no link on the way, matching
// the test files' patterns, no part of its path starting with `-`. Writes only under the root's .run/: the runs' data in WORK_FOLDER, removed once the page
// is drawn or the sweep stops, and the page in PAGE_FOLDER.

import { lstatSync, mkdirSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { insideRoot, noLinkOnTheWay, pathFrom, readPlainFile, replaceFile } from "../_files.mjs";
import { controlsReplaced } from "../_text.mjs";
import { testFileRuns } from "../project-tools/project-tools.mjs";
import { drawCardsPage } from "./lib/cards-page.mjs";
import { readCards } from "./lib/cards-file.mjs";

// the cards file's format, the contract between the test-reader agents and the sweep command: --help prints it
export { CARDS_FORMAT } from "./lib/cards-format.mjs";
import { openRunFolders } from "./lib/open-run-folders.mjs";
import { sweepCoverage } from "./lib/sweep-runs.mjs";

const PAGE_FOLDER = [".run", "test-sweep"]; // under the root: run output, which git ignores
const PAGE = "cards.html"; // the page's name in PAGE_FOLDER
const WORK_FOLDER = [".run", "test-sweep-runs"]; // under the root: the runs' data and results, removed after
const CARDS_CAP = 1024 * 1024; // bytes of the cards file: 500 cards of a long reason each
const LABEL = "test-sweep"; // each line the sweep says starts with it
// the fix when the commands file cannot leave cases out: no test file is run, and each card says it was not read
const ADD_RUN_CASES = "add `runCases` to docs/roadkeeper/commands.json: runTests' arguments and one holding {case}, "
  + "repeated for each case kept";

// Why the cards file at `file` cannot be read, the fix first, `given` as the command was given it; null when it can.
function cardsFileFault(root, file, given) {
  const shownGiven = controlsReplaced(given);
  const rest = relative(root, file);
  const isOutside = !rest || rest.startsWith("..") || isAbsolute(rest);
  if (isOutside) return `give a cards file inside the project; ${shownGiven} lies outside it`;
  if (!noLinkOnTheWay(root, file)) return `give a cards file with no link on its way from the project's root; ${shownGiven} has one`;
  if (!pathFrom(root, file)) return `give a cards file inside the project; ${shownGiven} lies outside it`;
  let stats = null;
  try { stats = lstatSync(file); } catch { /* no file there: said below */ }
  if (!stats?.isFile()) return `give a cards file that is a plain file; ${shownGiven} is none`;
  return stats.size > CARDS_CAP ? `give a cards file of at most ${CARDS_CAP / 1024 / 1024} MB; ${shownGiven} is over it` : null;
}

// The cards file's path from the root and its text: { shown, text }, or { refused } when it lies outside the root, sits
// behind a link, is no plain file or is over CARDS_CAP. `given` is read from `dir`, --root's folder, when relative.
function readCardsFile(root, dir, given) {
  const file = resolve(dir, given);
  const fault = cardsFileFault(root, file, given);
  const text = fault ? null : readPlainFile(file, CARDS_CAP);
  if (text === null) return { refused: fault ?? `give a cards file that can be read; ${controlsReplaced(given)} cannot` };
  return { shown: pathFrom(root, file), text };
}

// Whether a card's file, a test file's path from the root, names a plain file there with no link on the way.
function isPlainFileIn(root, path) {
  const file = join(root, ...path.split("/"));
  try { return noLinkOnTheWay(root, file) && lstatSync(file).isFile(); } catch { return false; }
}

// What the first card whose file cannot be run breaks: { card, what } or null. Its file must hold no part a runner
// would read as an option, match the test files' patterns, and be a plain file in the project.
function findUnrunnableFile(runs, cards) {
  for (const card of cards) {
    if (card.file.split("/").some((part) => part.startsWith("-"))) return { card: card.number, what: "no part of its file's path may start with -" };
    if (!runs.isTestFile(card.file)) return { card: card.number, what: `its file must be a test file, one matching ${runs.patternsLine}` };
    if (!isPlainFileIn(runs.root, card.file)) return { card: card.number, what: "its file must be a plain file in the project, with no link on the way" };
  }
  return null;
}

// The cards checked, their files held to the test files' patterns: { cards, shown } or { refused }, the line to say.
function checkedCards(runs, { dir, cardsFile }) {
  const cardsText = readCardsFile(runs.root, dir, cardsFile);
  if (cardsText.refused) return cardsText;
  const { cards, fault } = readCards(cardsText.text);
  const cardFault = fault ?? findUnrunnableFile(runs, cards);
  if (!cardFault) return { cards, shown: cardsText.shown };
  if (cardFault.card === null) return { refused: `write ${cardsText.shown} as one JSON array of cards (--help shows a card); ${cardFault.what}` };
  return { refused: `fix card ${cardFault.card} in ${cardsText.shown}: ${cardFault.what}` };
}

// The page written into `folder` for the cards and their coverage (sweepCoverage's { coverage, shared }): { page }, its
// path.
function writePage(folder, cards, { coverage, shared }) {
  const page = join(folder, PAGE);
  replaceFile(page, drawCardsPage(cards, coverage, shared));
  return { page };
}

// The cards' coverage read from runs in `work`, beforeTests' steps first: a promise of { coverage } or { refused }.
async function readCoverage(runs, { cards, shown, work }, say) {
  if (runs.noInstallLine) say(`${LABEL}: ${runs.noInstallLine}`);
  await runs.runBefore((line) => say(line.startsWith(" ") ? line : `${LABEL}: ${line}`));
  const folders = openRunFolders(work, { root: runs.root, codeFile: runs.codeFile });
  const found = await sweepCoverage({ runs, folders, say }, cards);
  if (found.fault) return { refused: `fix card ${found.fault.card} in ${shown}: ${found.fault.what}` };
  return found;
}

// `task` awaited with `folder` made empty first and removed after, however it ends: a promise of what it gives.
async function inEmptyFolder(folder, task) {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  try { return await task(); } finally { rmSync(folder, { recursive: true, force: true }); }
}

// The runs in `work`, the coverage read and the page written into `folder`: a promise of { page }, its path, or
// { refused }.
const runAndDraw = (runs, { cards, shown, folder, work }, say) => inEmptyFolder(work, async () => {
  const found = await readCoverage(runs, { cards, shown, work }, say);
  return found.refused ? found : writePage(folder, cards, found);
});

// The page written into `folder` with no test file run, each card saying it was not read for coverage: { page }.
function drawUnread({ cards, folder }, say) {
  say(`${LABEL}: no test file run, no card read for coverage: ${ADD_RUN_CASES}`);
  const unread = [`Its code was not read for coverage: ${ADD_RUN_CASES}.`];
  return writePage(folder, cards, { coverage: cards.map(() => ({ alone: null, unread })), shared: [] });
}

// The test sweep of the project at the worktree holding `dir`, on the cards file `cardsFile` (a path from `dir`, or
// absolute), each line handed to `say`: a promise of the exit code, 0 with the page written and its path
// said, 1 when it stops on a line naming the fix, no page drawn. A commands file with no `runCases` runs no test file:
// the page is drawn, each card saying it was not read for coverage.
export async function writeSweepPage({ dir, cardsFile }, say) {
  const stop = (line) => { say(`${LABEL}: ${line}`); return 1; };
  const runs = testFileRuns(dir);
  if (runs.refused) return stop(runs.refused);
  const checked = checkedCards(runs, { dir, cardsFile });
  if (checked.refused) return stop(checked.refused);
  const [folder, work] = [join(runs.root, ...PAGE_FOLDER), join(runs.root, ...WORK_FOLDER)];
  const outside = [PAGE_FOLDER, WORK_FOLDER].find((f) => !insideRoot(runs.root, join(runs.root, ...f, PAGE)));
  if (outside) return stop(`make ${outside.join("/")} a plain folder inside the project, or remove it; it is a link or outside it`);
  const drawn = runs.selectsCases ? await runAndDraw(runs, { ...checked, folder, work }, say) : drawUnread({ ...checked, folder }, say);
  if (drawn.refused) return stop(drawn.refused);
  say(`${LABEL}: page written to ${drawn.page}`);
  return 0;
}
