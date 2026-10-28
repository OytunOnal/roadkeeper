// @level domain
// Roadkeeper — the milestone rules: the board's labels and work in flight, what a milestone counts, its slices and the cap,
// an issue and its spec as one slice, a real use's slice, ready to close, a title's version and name, the milestones'
// version order and the last version. Reads milestones and issues as the tracker cleans them; plain data in and out,
// no disk, clock, network or process.

import { compareVersions, versionOf } from "./_text.mjs";

export const CAP = 5;                          // slices a milestone holds at most (steward's versions.md, The cap)
export const FOLD_LABEL = "duplicate";         // the label a folded issue closes with (GLOSSARY, Fold)
export const WAITING_LABEL = "waiting-on-you"; // the label of what only the human can act on (GLOSSARY, waiting-on-you)
const REAL_USE = /^Real use of #(\d{1,9})/;   // the title of the issue a merge opens for the slice's real use
const COMPLETED = "COMPLETED";                 // the close reason of a slice done, as the snapshot keeps it
const SPECCED = /^\s*specced in #(\d{1,9})\b/i; // the comment a slice issue closes with once its spec is published

// an issue folded into a slice that carries it: closed with the fold label
export const isFold = (i) => i.state === "CLOSED" && i.labels.includes(FOLD_LABEL);
export const isWaiting = (i) => i.labels.includes(WAITING_LABEL);
// a ticket: an issue with a parent, its spec
export const isTicket = (i) => Boolean(i.parent);
// The board's state labels, furthest along first, and whether an open issue carrying one is work in flight.
export const BOARD = [
  { label: "real-green", inFlight: false },
  { label: "mock-green", inFlight: true },
  { label: "active", inFlight: true },
];
// work in flight: an open issue labelled `active` or `mock-green` (GLOSSARY, In flight)
export const inFlight = (i) => i.state === "OPEN" && BOARD.some((b) => b.inFlight && i.labels.includes(b.label));
// work in flight wearing waiting-on-you, waiting on the human's word
export const inFlightWaitingOnYou = (i) => inFlight(i) && isWaiting(i);
// An issue that is work: no fold, no ticket, nothing the human owes but work in flight waiting on the human's word. The
// slices and the real-use issues kept are drawn from these.
export const isCounted = (i) => !isFold(i) && !isTicket(i) && (!isWaiting(i) || inFlight(i));

// the number of the slice a `Real use of #N` issue tries, or null for any other issue
export const realUseOf = (i) => { const m = REAL_USE.exec(i.title); return m ? Number(m[1]) : null; };

// Each closed issue specced in a spec, by its number, to the spec's: closed with a comment opening "specced in #N", N
// an issue in `issues` other than itself (the slice skill's Spec step). The spec stands for the issue: one slice.
export function specOf(issues) {
  const listed = new Set(issues.map((i) => i.number));
  const pairs = new Map();
  for (const i of issues.filter((x) => x.state === "CLOSED")) {
    for (const c of i.comments || []) {
      const spec = Number((SPECCED.exec(c.body) || [])[1]);
      if (spec !== i.number && listed.has(spec)) pairs.set(i.number, spec);
    }
  }
  return pairs;
}

// The number of the slice issue `n` belongs to: its spec's when it was specced (`specced`, specOf's), else its own.
export const sliceOf = (n, specced) => specced.get(n) || n;

// An issue open, or closed as completed. A slice closed undone is in no slice count and The Road draws it nowhere.
const isOpenOrDone = (i) => i.state === "OPEN" || i.stateReason === COMPLETED;

// A `Real use of #N` issue kept: counted, open or closed as completed. It is no slice; The Road draws it.
export const isKeptRealUse = (i) => isCounted(i) && realUseOf(i) !== null && isOpenOrDone(i);

// A slice as the cap counts it: a counted issue, no real-use issue, open or closed as completed, and none specced in a
// spec, `specced` (specOf): the spec counts for it.
const isSlice = (i, specced) => isCounted(i) && realUseOf(i) === null && isOpenOrDone(i) && !specced.has(i.number);

// every slice among `issues`, on a milestone or none; `specced` the issues' pairs, read once by a caller that has them
export const slicesIn = (issues, specced = specOf(issues)) => issues.filter((i) => isSlice(i, specced));

// milestone `m`'s slices among `issues`; `specced` as slicesIn's
export const slicesOf = (m, issues, specced = specOf(issues)) => slicesIn(issues, specced).filter((i) => i.milestone === m.number);

// Milestone `m`'s slices among `issues`, done and in all, and whether it is ready to close: open, at least one slice,
// every slice closed; a real-use issue still open does not hold it. `specced` as slicesIn's.
export function closingTally(m, issues, specced = specOf(issues)) {
  const held = slicesOf(m, issues, specced);
  const slicesDone = held.filter((i) => i.state !== "OPEN").length;
  return { slices: held.length, slicesDone, readyToClose: m.state === "open" && held.length > 0 && slicesDone === held.length };
}

const SEPARATOR = /^\s*[—–:-]?\s*/; // what parts a title's version from its name
// A title's `{ version, name }`: the version it opens with, or null, and the name past it and its separator, bare; with
// no version, the name is the title.
export function titleParts(title) {
  const version = versionOf(title);
  if (!version) return { version, name: title };
  return { version, name: title.slice(title.indexOf(version) + version.length).replace(SEPARATOR, "") };
}

// Milestones by their titles' versions, a title with none after them, then by number. A due date orders none.
export function inVersionOrder(milestones) {
  const byVersion = (a, b) => {
    const x = versionOf(a.title), y = versionOf(b.title);
    return Boolean(y) - Boolean(x) || (x && y ? compareVersions(x, y) : 0) || a.number - b.number;
  };
  return milestones.slice().sort(byVersion);
}

// the open milestones, in version order
export const openByVersion = (milestones) => inVersionOrder(milestones.filter((m) => m.state === "open"));

// The closed milestone holding the last version, the largest among the closed titles' (a number never goes back), or
// null with none.
export function lastVersion(milestones) {
  const versioned = milestones.filter((m) => m.state === "closed" && versionOf(m.title));
  return versioned.reduce((last, m) => (!last || compareVersions(versionOf(m.title), versionOf(last.title)) > 0 ? m : last), null);
}
