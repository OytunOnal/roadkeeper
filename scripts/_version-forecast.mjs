// @level domain
// Roadkeeper — the version forecast: each open milestone's slices and bump, and the number each would carry, from a tracker
// snapshot as the tracker cleans it. Plain data and the lines the command prints; no disk, clock, network or process.

import { CAP, lastVersion, openByVersion, slicesOf, titleParts } from "./_milestones.mjs";
import { compareVersions, controlsReplaced, cutAt, versionNumbers } from "./_text.mjs";

// A slice's bump by its labels, the first that matches: the user must act (X), internal work, a fix or polish (Z), a
// new promise (Y).
const BUMPS = [["major", "X"], ["internal", "Z"], ["bug", "Z"], ["polish", "Z"], ["enhancement", "Y"]];
const UNKINDED = "Y"; // a slice with none of those labels: a new promise until its kind is set, and listed
const EMPTY = "Z";    // a milestone with no slice: nothing a user would notice
const bumpOf = (i) => (BUMPS.find(([label]) => i.labels.includes(label)) || [null, null])[1];
const BUMP_ORDER = ["Z", "Y", "X"]; // the bumps from smallest to largest
// the larger of two bumps
const larger = (a, b) => (BUMP_ORDER.indexOf(a) >= BUMP_ORDER.indexOf(b) ? a : b);

// a version's three numbers, `v2.2` as 2.2.0
const partsOf = (v) => { const [x = 0, y = 0, z = 0] = versionNumbers(v); return [x, y, z]; };
// the number after a release, by the bump: X → (X+1).0.0, Y → X.(Y+1).0, Z → X.Y.(Z+1)
const STEP = { X:([x]) => [x + 1, 0, 0], Y: ([x, y]) => [x, y + 1, 0], Z: ([x, y, z]) => [x, y, z + 1] };

// the numbers numbering starts from: the last version's three, or 0.0.0 with none
function numberingStart(snap) {
  const last = lastVersion(snap.milestones);
  return last ? partsOf(titleParts(last.title).version) : [0, 0, 0];
}

const LAUNCH = "v1.0.0"; // the launch's number: before it, X raises Y; a milestone titled with it keeps it
// the number after `last` for a bump, or the launch's for the launch milestone, titled `version`, while below it
function nextNumber(last, version, bump) {
  const beforeLaunch = last[0] < 1;
  if (beforeLaunch && compareVersions(version, LAUNCH) === 0) return partsOf(LAUNCH);
  return STEP[beforeLaunch && bump === "X" ? "Y" : bump](last);
}

// Each milestone's forecast title, `v<n> — <name>` or `v<n>` with no name, walking them in order from the last version;
// a title opening on no version has none.
function numbered(milestones, from) {
  let last = from;
  return milestones.map((m) => {
    const { version, name } = titleParts(m.title);
    if (!version) return { ...m, next: null };
    last = nextNumber(last, version, m.bump);
    const number = `v${last.join(".")}`;
    return { ...m, next: name ? `${number} — ${name}` : number };
  });
}

// Why an order given by milestone numbers is not the open milestones', each once, or null when it is.
function orderRefused(open, order) {
  const numbers = new Set(open.map((m) => m.number));
  const notOpen = order.find((n) => !numbers.has(n));
  if (notOpen !== undefined) return `#${notOpen} is not an open milestone`;
  const twice = order.find((n, at) => order.indexOf(n) !== at);
  if (twice !== undefined) return `#${twice} is named twice`;
  const missing = open.find((m) => !order.includes(m.number));
  return missing ? `#${missing.number}, an open milestone, is not named` : null;
}

// The open milestones of the snapshot, each with its slices counted, its room under the cap, its bump and its forecast
// title, in `order` (their numbers), or by version when it is empty: `{ milestones }`, or `{ refused }` with why the
// order is not theirs.
export function forecast(snap, order = []) {
  const open = openByVersion(snap.milestones);
  const refused = order.length ? orderRefused(open, order) : null;
  if (refused) return { refused };
  const ordered = order.length ? order.map((n) => open.find((m) => m.number === n)) : open;
  const heldBy = (m) => slicesOf(m, snap.issues);
  const counted = ordered.map((m) => {
    const slices = heldBy(m);
    const bump = slices.map((i) => bumpOf(i) || UNKINDED).reduce(larger, EMPTY);
    return { number: m.number, title: m.title, slices: slices.length, room: CAP - slices.length, bump };
  });
  const noKind = ordered.flatMap(heldBy).filter((i) => !bumpOf(i)).map((i) => ({ number: i.number, title: i.title }));
  return { milestones: numbered(counted, numberingStart(snap)), noKind };
}

// Whether a snapshot keeps how its issues closed: false when issues are closed and none keeps a close reason, as in a
// snapshot written before it kept them, where every closed slice would read as not done.
export const keepsCloseReasons = (snap) => {
  const closed = snap.issues.filter((i) => i.state === "CLOSED");
  return !closed.length || closed.some((i) => i.stateReason);
};

const SHOWN = 120; // characters of a title printed: enough to know it, short enough for one line
// A stranger's title as printed: made printable, cut at SHOWN.
const shown = (title) => {
  const t = controlsReplaced(title);
  return t.length > SHOWN ? cutAt(t, SHOWN) + "…" : t;
};

// What the command prints of a forecast: a line per open milestone, then one per slice with no kind.
export function forecastLines({ milestones, noKind }) {
  const next = (m) => (m.next === null ? "no version: not renumbered" : shown(m.next));
  return [
    ...milestones.map((m) => `#${m.number}  ${shown(m.title)}  slices ${m.slices}  room ${m.room}  bump ${m.bump}  → ${next(m)}`),
    ...noKind.map((i) => `no kind  #${i.number}  ${shown(i.title)}`),
  ];
}

// What the command says of each rename step the tracker sent ({ number, from, to, error }): renamed, or refused with
// `gh`'s line.
export const renameLines = (steps) => steps.map((s) => s.error
  ? `refused #${s.number}  ${shown(s.from)}  → ${shown(s.to)}  (${shown(s.error)})`
  : `renamed #${s.number}  ${shown(s.from)}  → ${shown(s.to)}`);
