// @level presentation
// Roadkeeper — the session-start line: what The Road's model counts, in one line, from the model and how the tracker was
// read. Only counts, issue numbers, metric row ids, a milestone's version as the version pattern reads it from its
// title, and fixed words reach it. Two sentences from the one count: the human's says "you", Claude's "the human".
// No disk, clock, network or process.

import { daysBetween, isCalendarDate, nounFor, plural } from "../../_text.mjs";
import { versionOf } from "../../_versions.mjs";
import { describeFailure } from "../../_tracker-words.mjs";
import { SET_ASIDE_WORDS, labelWaiting } from "./waiting-words.mjs";

const SHOWN = 10; // issue numbers named per count; the rest counted

// the step this line and The Road's page give a failed read that passes on its own
export const SESSION_START_AGAIN = "the next session start reads it again";

const numbers = (list) => list.slice(0, SHOWN).map((i) => `#${i.number}`).join(", ") + (list.length > SHOWN ? ` and ${list.length - SHOWN} more` : "");

const TO_HUMAN = { waitsOn: "you", runs: "you run" }; // the sentence shown to the human speaks to them
const TO_CLAUDE = { waitsOn: "the human", runs: "the human runs" }; // Claude's: it never takes "you" for itself

// the waiting-on-you clause: how many of today's, which, how many late past the model's threshold, and the oldest known
// age when one is known
function makeWaitClause({ open, lateAfterDays }, wording) {
  const late = open.filter((w) => w.late).length;
  const ages = open.map((w) => w.age).filter((a) => a !== null);
  const lateClause = late ? `, ${late} past ${lateAfterDays} days` : "";
  const oldest = ages.length ? `, the oldest ${plural(Math.max(...ages), "day")}` : "";
  return `${open.length} ${labelWaiting(wording.waitsOn)} (${numbers(open)})${lateClause}${oldest}`;
}

// the set-aside clause: the waiting-on-you issues that wait on something else first, never counted late or aged;
// the option `more` says "more" after a waiting clause
function makeAsideClause(setAside, { more = false } = {}) {
  return `${setAside.length} ${more ? "more " : ""}${SET_ASIDE_WORDS} (${numbers(setAside)})`;
}

// the line from the model's counts, in one reader's `wording`; null when there is nothing to say
function makeSentence(road, source, wording) {
  const { untriaged, due, waiting } = road;
  const current = road.next.milestone;
  const said = [];
  if (source) said.push(source);
  // the version as the pattern reads it from the title, so no title text reaches the session
  if (current && current.readyToClose) said.push(`${versionOf(current.title) || "the current milestone"}: every slice closed, ready to close`);
  if (untriaged.length) said.push(`${plural(untriaged.length, "issue")} untriaged (${numbers(untriaged)}): ${wording.runs} /triage`);
  if (waiting.open.length) said.push(makeWaitClause(waiting, wording));
  if (waiting.setAside.length) said.push(makeAsideClause(waiting.setAside, { more: waiting.open.length > 0 }));
  if (due.length) said.push(`${plural(due.length, "metric reading is", "metric readings are")} due (${nounFor(due.length, "row")} ${due.slice(0, SHOWN).join(", ")}): call steward with no report`);
  return said.length ? `Roadkeeper: ${said.join("; ")}.` : null;
}

// a day as the line names it, `18 Nov`, read in UTC as the snapshot's time is written
const DAY_NAMED = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
const nameDay = (day) => {
  const parts = DAY_NAMED.formatToParts(new Date(`${day}T00:00:00Z`));
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part("day")} ${part("month")}`;
};

// The snapshot standing in, by its day and its age on `today`: "the snapshot of 18 Nov, 2 days old"; one whose time is
// unknown, or not a calendar day, said so.
function nameSnapshot({ fetched }, today) {
  const day = fetched ? fetched.slice(0, 10) : "";
  const age = isCalendarDate(day) ? daysBetween(day, today) : null;
  if (age === null) return "a snapshot of unknown date";
  return `the snapshot of ${nameDay(day)}, ${age > 0 ? `${plural(age, "day")} old` : "taken today"}`;
}

// Where the counts come from when the read was not live: the failed read named by its kind, in the words The Road's
// page says it (describeFailure), then the snapshot standing in, or that with none no issue is counted; "" for a live
// read.
function sourceOf({ live, snapshot, failure, today }) {
  if (live) return "";
  const unread = `the tracker could not be read${failure ? ` (${describeFailure(failure, { again: SESSION_START_AGAIN })})` : ""}`;
  return snapshot ? `${unread}; these counts are from ${nameSnapshot(snapshot, today)}` : `${unread}; there is no snapshot, so no issue is counted`;
}

// The session-start line from `road`, the road model, and `read`, how the tracker was read: { live, snapshot,
// failure, today }, whether the read was live, the snapshot read as { fetched }, its time as the snapshot file holds
// it, or null with none, a failed read's kind (FAILURE_KIND), and today as YYYY-MM-DD, all from the caller. { shown,
// given }: the human's sentence and Claude's, both from the one model so they never disagree on a number; both null
// when there is nothing to say.
export function sessionLine(road, read) {
  const source = sourceOf(read);
  return { shown: makeSentence(road, source, TO_HUMAN), given: makeSentence(road, source, TO_CLAUDE) };
}
