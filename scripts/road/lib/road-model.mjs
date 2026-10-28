// @level domain
// Roadkeeper — the road model: The Road's decisions, from a tracker snapshot, a date and the sources read.
//
// roadModel(snap, today, sources) builds it from the snapshot as the tracker cleans it, today as YYYY-MM-DD, and the
// sources read: `metrics`, the metrics table's text. Returns plain data, numbers, dates, labels and flags; the page and
// the nudge word them. No disk, clock, network or HTML.

import {
  BOARD, FOLD_LABEL, WAITING_LABEL, closingTally, inFlight, inFlightWaitingOnYou, inVersionOrder, isCounted, isFold, isKeptRealUse, isTicket,
  isWaiting, lastVersion, openByVersion, realUseOf, sliceOf, slicesIn, specOf, titleParts,
} from "../../_milestones.mjs";
import { cutAt, daysBetween, isCalendarDate, readerLines, versionNumbers } from "../../_text.mjs";

const WAIT_DAYS = 7; // a waiting-on-you issue open longer than a week is late: The Road's strip and the nudge say it
const CANDIDATE_SCAN = 2000; // characters of a body scanned for its bet
const ANSWERED = 50;         // the answered waiting-on-you issues kept, latest first
// A tracker filter's part leaving out folds, waiting-on-you issues and tickets: what no count holds, but a waiting
// issue in flight, which counts on its milestone and is left out all the same. The tracker's search finds a folded
// issue by its label alone, closed or open.
const OFF_ROAD = { labelsOut: [FOLD_LABEL, WAITING_LABEL], parent: false };
// label families an issue carries one of at most
const STATE_FAMILIES = [
  BOARD.map((b) => b.label),
  ["needs-triage", "needs-info", "ready-for-agent", "ready-for-human", "wontfix"],
];

const has = (i, label) => i.labels.includes(label);
const isOpen = (i) => i.state === "OPEN";
const byNumber = (a, b) => a.number - b.number;
const byClosed = (a, b) => String(a.closedAt || "").localeCompare(String(b.closedAt || "")) || byNumber(a, b);
// the furthest board label an issue carries, or null
const boardOf = (i) => (BOARD.find((b) => has(i, b.label)) || { label: null }).label;

// Rail order: furthest along first, then by number.
const boardRank = (i) => { const at = BOARD.findIndex((b) => b.label === i.board); return at < 0 ? BOARD.length : at; };
const alongRail = (issues) => issues.slice().sort((a, b) => boardRank(a) - boardRank(b) || byNumber(a, b));

// The bet an issue rests on: the text after `Bet:` in its body, to the end of that paragraph.
function betOf(body) {
  const scan = cutAt(String(body || ""), CANDIDATE_SCAN);
  const m = /\*{0,2}bet\*{0,2}:\*{0,2}[ \t]*/i.exec(scan);
  if (!m) return null;
  const rest = scan.slice(m.index + m[0].length);
  const end = rest.search(/\n\s*\n/);
  return (end >= 0 ? rest.slice(0, end) : rest).replace(/\s+/g, " ").trim().replace(/[*\s]+$/, "") || null;
}

// the lead of the paragraph a real-use issue names what it waits on with (skills/slice/SKILL.md, step 10, Later use)
export const WAITS_ON = /^\s*\*\*Waits on:\*\*[ \t]*/i;

// The line an issue's body names what it waits on with: its last paragraph after `**Waits on:**`, on one line, its last
// full stop dropped; "" with none.
function waitsOnLineOf(body) {
  const paragraphs = readerLines(body).join("\n").split(/\n\s*\n/).filter((p) => p.trim());
  const last = paragraphs[paragraphs.length - 1] || "";
  return WAITS_ON.test(last) ? last.replace(WAITS_ON, "").replace(/\s+/g, " ").trim().replace(/\.$/, "") : "";
}

// What issue `i` says it waits on: its line (waitsOnLineOf) and `refs`, the issues of `known` (number to address) the
// line names as `#N`; null with no line.
function waitsOnOf(i, known) {
  const line = waitsOnLineOf(i.body);
  if (!line) return null;
  const named = [...new Set([...line.matchAll(/#(\d{1,9})\b/g)].map((m) => Number(m[1])))];
  return { line, refs: named.filter((n) => known.has(n)).map((n) => ({ number: n, url: known.get(n) })) };
}

// a milestone's version as drawn: its title's, or the title itself when it opens on none
const drawnVersion = (title) => titleParts(title).version || title;

// a milestone's version and name, once: "vX.Y — <name>", the version alone with no name apart from it
function headingOf(title) {
  const version = drawnVersion(title), name = titleParts(title).name;
  return name && name !== version ? `${version} — ${name}` : version;
}

// The word a milestone's marker says beside its version: an open one planned; a closed one released from v1 on, closed
// before (GLOSSARY, Release: a milestone closed from v1 on; steward's versions.md: before the launch, v0.Y.Z).
function markerOf(m) {
  if (m.state !== "closed") return "planned";
  const version = titleParts(m.title).version;
  return version && versionNumbers(version)[0] >= 1 ? "released" : "closed";
}

// Closed milestones in the order they closed; open ones in the milestones' order, the first the current one. Each with
// its version as drawn, its name, its heading and its marker's word.
function milestonesOf(snap) {
  const shape = (m) => ({
    number: m.number, title: m.title, version: drawnVersion(m.title), name: titleParts(m.title).name,
    heading: headingOf(m.title), marker: markerOf(m), current: false,
    description: m.description, state: m.state, due: m.due, closedAt: m.closedAt,
  });
  const closed = snap.milestones.filter((m) => m.state === "closed").sort(byClosed);
  return { closed: closed.map(shape), open: openByVersion(snap.milestones).map((m, at) => ({ ...shape(m), current: at === 0 })) };
}

// The issues drawn: none folded, which is drawn nowhere, counted nowhere and never flagged. Each carries its
// milestone's version (null with none), its board label, its tickets by number with how many are closed, and, in
// flight, what it waits on: `waitsOnYou`, wearing waiting-on-you, else `waitsOn` (waitsOnOf), or null.
function placed(snap) {
  const versions = new Map(snap.milestones.map((m) => [m.number, drawnVersion(m.title)]));
  const known = new Map(snap.issues.map((i) => [i.number, i.url]));
  const waits = (i) => ({ waitsOnYou: inFlightWaitingOnYou(i), waitsOn: inFlight(i) && !isWaiting(i) ? waitsOnOf(i, known) : null });
  const kept = snap.issues.filter((i) => !isFold(i));
  const ticketsOf = new Map();
  for (const t of kept.filter(isTicket).sort(byNumber)) {
    if (!ticketsOf.has(t.parent)) ticketsOf.set(t.parent, []);
    ticketsOf.get(t.parent).push({ number: t.number, title: t.title, state: t.state, url: t.url });
  }
  return kept.map((i) => {
    const tickets = ticketsOf.get(i.number) || [];
    return {
      ...i, version: (i.milestone && versions.get(i.milestone)) || null, board: boardOf(i),
      tickets, ticketsClosed: tickets.filter((t) => !isOpen(t)).length, ...waits(i),
    };
  });
}

// an issue as the page links it: its number and address
const refOf = (i) => ({ number: i.number, url: i.url });

// the day an ISO timestamp falls on, as written (`2026-09-20T10:00:00Z` → `2026-09-20`), or "" for none
export const dayOf = (x) => (x ? x.slice(0, 10) : "");

// the day an issue's wait counts from: for work in flight wearing waiting-on-you, the day the label was last added;
// else, or with that day unread, its creation, else the day Roadkeeper first saw it, else ""
const startOf = (i) => (inFlightWaitingOnYou(i) && dayOf(i.waitingSince)) || dayOf(i.createdAt) || dayOf(i.seenAt);

// whole days a waiting-on-you issue has been open, or null, and whether that is late
function ageOf(i, today) {
  const age = daysBetween(startOf(i), today);
  return { age, late: age !== null && age > WAIT_DAYS };
}

// the longest waiting first, an issue with no start last, then by number
function byWait(a, b) {
  const x = startOf(a), y = startOf(b);
  return (x && y ? x.localeCompare(y) : Boolean(y) - Boolean(x)) || byNumber(a, b);
}

// The metric rows whose next reading is today or past, by row number: a row's first cell names it, its last holds the
// next reading; the table ends at the readings heading.
function dueOf(metrics, today) {
  const due = [];
  for (const line of String(metrics || "").split("\n")) {
    if (/^##\s+readings/i.test(line)) break;
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    const next = cells[cells.length - 1];
    const isRow = cells.length >= 3 && /^\d{1,4}$/.test(cells[0]);
    const isDue = isCalendarDate(next) && next <= today;
    if (isRow && isDue) due.push(cells[0]);
  }
  return due;
}

// An open real-use issue of a closed milestone's that names nothing it waits on, no `**Waits on:**` line and no
// waiting-on-you: the milestone's version, its marker's word and its close day; else null.
function silentRealUseOf(i, milestones) {
  const m = milestones.get(i.milestone);
  const silent = isOpen(i) && realUseOf(i) !== null && !isWaiting(i) && !waitsOnLineOf(i.body);
  const ofClosed = Boolean(m) && m.state === "closed";
  return silent && ofClosed ? { version: drawnVersion(m.title), marker: markerOf(m), closed: dayOf(m.closedAt) } : null;
}

function flagsOf(snap) {
  const flags = [];
  const milestones = new Map(snap.milestones.map((m) => [m.number, m]));
  for (const i of snap.issues.filter((x) => !isFold(x))) {
    const silent = silentRealUseOf(i, milestones);
    if (silent) flags.push({ issue: i, kind: "silent-real-use", ...silent });
    for (const family of STATE_FAMILIES) {
      const on = family.filter((l) => has(i, l));
      if (on.length > 1) flags.push({ issue: i, kind: "family", labels: on });
    }
    if (i.state === "CLOSED" && has(i, "active")) flags.push({ issue: i, kind: "closed-active" });
  }
  return flags;
}

// The issues The Road draws, each with `from`, the issues specced in it, and `realUses`, its real uses kept, open or
// closed, by number: every slice (slicesIn), an issue and its spec one slice, drawn as the spec; every real use kept,
// on its slice when that is drawn, on its milestone or another; an open one is drawn on its own too, a closed one only
// with no slice drawn.
function drawnIssuesOf(snap, issues, specced) {
  const sliceNumbers = new Set(slicesIn(snap.issues, specced).map((i) => i.number));
  const shaped = issues.filter(isCounted).sort(byNumber).map((i) => ({ ...i, from: [], realUses: [] }));
  const drawnIssues = shaped.filter((i) => sliceNumbers.has(i.number));
  const sliceByNumber = new Map(drawnIssues.map((s) => [s.number, s]));
  for (const i of shaped) {
    const spec = sliceOf(i.number, specced);
    if (spec !== i.number && sliceByNumber.has(spec)) sliceByNumber.get(spec).from.push(refOf(i));
  }
  for (const use of shaped.filter(isKeptRealUse)) {
    const slice = sliceByNumber.get(sliceOf(realUseOf(use), specced));
    if (slice) slice.realUses.push(refOf(use));
    if (isOpen(use) || !slice) drawnIssues.push(use);
  }
  return drawnIssues;
}

// Done: the closed issues drawn of each closed milestone, a group each in version order, by the time they closed; then
// `noMilestone`, those with no milestone (or one not listed), by the time they closed.
function doneOf(drawnIssues, ms) {
  const closed = drawnIssues.filter((i) => i.state === "CLOSED").sort(byClosed);
  const listed = new Set([...ms.closed, ...ms.open].map((m) => m.number));
  const groups = inVersionOrder(ms.closed).map((milestone) => ({ milestone, issues: closed.filter((i) => i.milestone === milestone.number) }));
  const noMilestone = closed.filter((i) => !listed.has(i.milestone));
  return { groups, noMilestone, issues: groups.reduce((n, g) => n + g.issues.length, noMilestone.length), milestones: ms.closed.length };
}

// Each milestone with its slices, done and in all, and whether it is ready to close.
function tallied(ms, issues, specced) {
  const tally = (m) => ({ ...m, ...closingTally(m, issues, specced) });
  return { closed: ms.closed.map(tally), open: ms.open.map(tally) };
}

export const SLICES_SHARE = 90; // the bar's percent the slices fill; the release, which closes the milestone, the rest

// The current milestone's progress, null with no milestone open: `filled`, the slices' own track's share done, rounded
// down, null with no slice; `realUsesOpen`, its real-use issues still open, by number; and `link`, where its line
// leads: its issues as a tracker filter, or its own page, `milestone`, where the tracker's search cannot quote a title
// holding a double quote. The filter keeps waiting-on-you issues: one in flight counts on the milestone, and the search
// cannot keep it while leaving out the others.
function progressOf(current, work) {
  if (!current) return null;
  const filter = { milestone: current.title, labelsOut: [FOLD_LABEL], parent: false };
  const link = current.title.includes('"') ? { milestone: current.number } : { filter };
  const filled = current.slices ? Math.floor((100 * current.slicesDone) / current.slices) : null;
  const realUsesOpen = work.filter((i) => isKeptRealUse(i) && isOpen(i) && i.milestone === current.number).sort(byNumber).map(refOf);
  return { milestone: current, filled, realUsesOpen, link };
}

// The last issue closed real-green, null with none: its day, the days since, its number and address, and `more`, the
// others closed real-green that day.
function realGreenOf(work, today) {
  const greens = work.filter((i) => i.state === "CLOSED" && has(i, "real-green")).sort(byClosed);
  if (!greens.length) return null;
  const last = greens[greens.length - 1], date = dayOf(last.closedAt);
  if (!date) return null;
  const more = greens.filter((i) => dayOf(i.closedAt) === date).length - 1;
  return { date, days: daysBetween(date, today), issue: refOf(last), more };
}

function countersOf(road, today) {
  const { ms, work, waitingOpen, later } = road;
  const last = lastVersion(ms.closed);
  return {
    lastVersion: last ? { version: last.version, closed: dayOf(last.closedAt) || null, marker: last.marker } : null,
    realGreen: realGreenOf(work, today),
    waiting: waitingOpen.length,
    candidates: later.length,
    filters: filtersOf(),
  };
}

// Each counter's issues as a tracker filter: `state`, `labelsIn`, `labelsOut`, `milestone` (a title, or false for
// none) and `parent` (false for none); a field left out filters nothing.
function filtersOf() {
  const flying = BOARD.filter((b) => b.inFlight).map((b) => b.label);
  return {
    realGreen: { state: "closed", labelsIn: ["real-green"], ...OFF_ROAD },
    waiting: { state: "open", labelsIn: [WAITING_LABEL] },
    candidates: { state: "open", labelsIn: ["enhancement"], milestone: false, labelsOut: [...flying, WAITING_LABEL].sort(), parent: false },
  };
}

// every open issue on an open milestone, then the work in flight with no milestone, then every candidate, that carries
// a bet; `version` null for one with no milestone
function betsOf({ ms, issuesOf, flyingNoMilestone, later }) {
  const bets = [];
  const row = (issue, version) => {
    const bet = betOf(issue.body);
    if (bet) bets.push({ issue, bet, version });
  };
  for (const m of ms.open) for (const i of issuesOf(m).filter(isOpen)) row(i, m.version);
  for (const i of [...flyingNoMilestone, ...later]) row(i, null);
  return bets;
}

// The groups: Done, each closed milestone's issues drawn, then those with no milestone; Now, the open issues drawn in
// flight on any milestone or none; Next, the current milestone's other issues drawn, closed first, then queued, and how
// many of its issues are in Now; Ahead, each later milestone's the same, the first drawn open, then the candidates. A
// ticket, a fold, an issue closed undone and an issue specced in a spec are in none; work in flight with no milestone
// is counted in no milestone.
export function roadModel(snap, today, sources) {
  const listed = milestonesOf(snap);
  const issues = placed(snap);
  const work = issues.filter(isCounted);
  const specced = specOf(snap.issues);
  const drawnIssues = drawnIssuesOf(snap, issues, specced);
  const waiting = issues.filter(isWaiting);
  const issuesOf = (m) => work.filter((i) => i.milestone === m.number);
  const ms = tallied(listed, snap.issues, specced);
  const current = ms.open[0] || null;
  const flying = drawnIssues.filter(inFlight);
  const queued = (i) => isOpen(i) && !inFlight(i);
  // the issues drawn under milestone `m` but those in flight: the closed ones first, by close time, then the queued
  const drawnUnder = (m) => {
    const on = drawnIssues.filter((i) => i.milestone === m.number);
    return [...on.filter((i) => !isOpen(i)).sort(byClosed), ...alongRail(on.filter(queued))];
  };
  const isCandidate = (i) => !i.milestone && has(i, "enhancement");
  const later = drawnIssues.filter((i) => isCandidate(i) && queued(i)).sort(byNumber);
  const ahead = ms.open.slice(1).map((milestone, at) => ({ milestone, issues: drawnUnder(milestone), open: at === 0 }));
  const waitingOpen = waiting.filter(isOpen).sort(byWait).map((i) => ({ ...i, ...ageOf(i, today) }));
  return {
    tracker: { fetched: snap.fetched, repo: snap.repo, url: snap.url },
    milestones: ms,
    progress: progressOf(current, work),
    done: doneOf(drawnIssues, ms),
    now: { issues: alongRail(flying), inFlight: flying.length },
    next: { milestone: current, issues: current ? drawnUnder(current) : [], inFlight: current ? flying.filter((i) => i.milestone === current.number).length : 0 },
    ahead: { milestones: ahead, count: ahead.reduce((n, a) => n + a.issues.length, 0), later },
    waiting: { open: waitingOpen, answered: waiting.filter((i) => i.state === "CLOSED").sort(byClosed).reverse().slice(0, ANSWERED), lateAfterDays: WAIT_DAYS },
    untriaged: snap.issues.filter((i) => isOpen(i) && (i.labels.length === 0 || has(i, "needs-triage"))).sort(byNumber),
    flags: flagsOf(snap),
    bets: betsOf({ ms, issuesOf, flyingNoMilestone: alongRail(flying.filter((i) => !i.milestone)), later }),
    counters: countersOf({ ms, work, waitingOpen, later }, today),
    due: dueOf(sources.metrics, today),
  };
}
