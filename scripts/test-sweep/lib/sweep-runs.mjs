// @level application
// Roadkeeper — the test sweep's runs: every test file of the suite run whole once, side by side, then each test file
// the cards name run without every card's cases, then, when several cards share it, without each card's cases alone;
// every run under each coverage reader, its data and results in a folder of its own the run folders it is handed make
// (open-run-folders.mjs), removed once read. A reader that could not read a carded file's whole run says so on each of its
// cards. A line the whole run reached and a left-out run did not is lost: a card's own lines are those lost without its
// cases alone, every carded case of the file for a file of one card; a line lost only without them all is the file's,
// said once for it. A line another test file's whole run reached is dropped from both: what is left only those
// cases reach in the whole suite. A run keeping no case is not run: it reaches nothing, as the file deleted would.

import { joinReaches, linesLost, Reach } from "./reached-lines.mjs";

// the fix when a left-out run ran a case it was given to leave out
const CASES_NOT_CHOSEN = "make `runCases` in docs/roadkeeper/commands.json run only the cases its {case} arguments "
  + "name: its run of a test file ran a case it was to leave out";

// What the coverage readers read of a run in `folder`, each skipped data file said: { reach, unread }, `reach` what
// they read joined, `unread` what the readers that could not read their code say (coverage-readers.mjs's `unread`).
function readRunCoverage(sweep, folder, name) {
  const readings = sweep.folders.read(folder);
  for (const r of readings.filter((x) => x.skipped)) sweep.say(`test-sweep: ${r.skipped} of ${r.name}'s coverage files, sources or script URLs in run ${name} not read: over the cap, not its data or naming no file`);
  return { reach: joinReaches(readings.map((r) => r.reached)), unread: readings.map((r) => r.unread).filter(Boolean) };
}

// One run of the test file under every coverage reader by `start` (the project tools' runWhole or runKeeping), in the
// folder `name` names under the work folder, removed once read: a promise of { ran, cases, reach, unread }, its cases
// those of the file.
async function coveredRun(sweep, start, { file, keep, name }) {
  const { run, folder } = sweep.folders.make({ file, keep, name });
  try {
    const { ran, cases } = await start(run);
    return { ran, cases: cases.filter((c) => c.file === file), ...readRunCoverage(sweep, folder, name) };
  } finally {
    sweep.folders.remove(folder);
  }
}

// The test file run whole under every coverage reader (coveredRun): a promise of { ran, cases, reach, unread }.
const wholeRun = (sweep, { file, name }) => coveredRun(sweep, sweep.runs.runWhole, { file, name });

// The test file run keeping only the case ids `keep` (coveredRun); none kept runs nothing and reaches nothing.
async function keepingRun(sweep, { file, keep, name }) {
  if (!keep.length) return { ran: null, cases: [], reach: new Reach(), unread: [] };
  return coveredRun(sweep, sweep.runs.runKeeping, { file, keep, name });
}

// Every test file of the suite and every carded one run whole, side by side: a promise of a Map of each file to its
// wholeRun.
async function suiteRuns(sweep, cardedFiles) {
  const files = [...new Set([...sweep.runs.testFiles(), ...cardedFiles])];
  const wholes = await sweep.runs.runSideBySide(files.map((file, k) => () => wholeRun(sweep, { file, name: `suite-${k + 1}` })));
  return new Map(files.map((file, k) => [file, wholes[k]]));
}

// The lines the whole run lost when the file ran without `leftOut` (a Set of case ids): a promise of { lost } or
// { refused }, when the run ran one of them anyway. `whole`: wholeRun's, `ids` every case id it read.
async function lostWithout(sweep, { file, whole, ids, leftOut, name }) {
  const left = await keepingRun(sweep, { file, keep: ids.filter((id) => !leftOut.has(id)), name });
  if (left.cases.some((c) => leftOut.has(c.id))) return { refused: CASES_NOT_CHOSEN };
  return { lost: linesLost(whole.reach, left.reach) };
}

// The first case of `fileCards` the whole run did not read: { card, what } or null.
function findUnreadCase(fileCards, ids) {
  for (const card of fileCards) {
    const missing = card.cases.findIndex((id) => !ids.includes(id));
    if (missing >= 0) return { card: card.number, what: `its case ${missing + 1} is not a case its test file ran` };
  }
  return null;
}

// Each card's own lines lost when several cards share the file: a promise of { alone, shared }, `alone` the cards'
// reaches in their order, `shared` what only all of them together reached, or { refused }. `file`: { file, whole, ids,
// lostAll, index }.
async function narrowToCards(sweep, file, fileCards) {
  const alone = [];
  for (const card of fileCards) {
    const without = await lostWithout(sweep, { ...file, leftOut: new Set(card.cases), name: `file-${file.index}-without-card-${card.number}` });
    if (without.refused) return without;
    alone.push(linesLost(without.lost, new Reach(), file.lostAll));
  }
  return { alone, shared: linesLost(file.lostAll, joinReaches(alone)) };
}

// The lines one test file's cards lost: a promise of { alone, shared } (narrowToCards'), or { fault: { card, what } }
// or { refused }. `whole`: wholeRun's run of the file.
async function fileLost(sweep, { file, index, whole }, fileCards) {
  if (!whole.cases.length) return { fault: { card: fileCards[0].number, what: `its file's run read no case (${whole.ran.why || "exit 0"})` } };
  const ids = [...new Set(whole.cases.map((c) => c.id))];
  const unread = findUnreadCase(fileCards, ids);
  if (unread) return { fault: unread };
  const leftOut = new Set(fileCards.flatMap((c) => c.cases));
  const all = await lostWithout(sweep, { file, whole, ids, leftOut, name: `file-${index}-without-all` });
  if (all.refused) return all;
  if (fileCards.length === 1) return { alone: [all.lost], shared: new Reach() };
  return narrowToCards(sweep, { file, whole, ids, lostAll: all.lost, index }, fileCards);
}

// The lines of the suite's other test files' whole runs (suiteRuns'), joined: a reach.
const otherFilesReach = (wholes, file) => joinReaches([...wholes].filter(([other]) => other !== file).map(([, w]) => w.reach));

// One test file's cards' coverage in the whole suite: a promise of { coverage, shared }, each card's { alone, unread }
// in the cards' order and the file's lines only its cards together reached, a line another test file reached dropped
// from both; or { fault } or { refused }.
async function fileCoverage(sweep, { file, index, wholes }, fileCards) {
  const whole = wholes.get(file);
  const lost = await fileLost(sweep, { file, index, whole }, fileCards);
  if (!lost.alone) return lost;
  const others = otherFilesReach(wholes, file);
  return { coverage: lost.alone.map((own) => ({ alone: linesLost(own, others), unread: whole.unread })),
    shared: linesLost(lost.shared, others) };
}

// Each card's coverage lines, from the whole suite's runs and the runs of the test files the cards name: a promise of
// { coverage, shared }, `coverage` each card's { alone, unread } (a reach, and what the readers say) in the cards'
// order, `shared` each file's lines only its cards together reached, { file, lines }, for a file whose cards
// share some; or { fault: { card, what } }, a card naming a case its file's run did not read, or whose file's run read
// none; or { refused }, the line saying how to fix the commands file. `sweep`, the adapters it calls: { runs, folders, say },
// `runs` the project tools' testFileRuns, `folders` the run folders the runs write in (open-run-folders.mjs's
// openRunFolders), `say` what takes each line said.
export async function sweepCoverage(sweep, cards) {
  const files = [...new Set(cards.map((c) => c.file))];
  const wholes = await suiteRuns(sweep, files);
  const byCard = new Map();
  const shared = [];
  for (const [index, file] of files.entries()) {
    const fileCards = cards.filter((c) => c.file === file);
    const found = await fileCoverage(sweep, { file, index: index + 1, wholes }, fileCards);
    if (!found.coverage) return found;
    for (const [k, card] of fileCards.entries()) byCard.set(card.number, found.coverage[k]);
    if (found.shared.size) shared.push({ file, lines: found.shared });
  }
  return { coverage: cards.map((c) => byCard.get(c.number)), shared };
}
