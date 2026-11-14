// @level domain
// Roadkeeper — the session-start line: what The Road's model counts, in one line, from the model and how the tracker was
// read. Only counts, issue numbers, metric row ids, a milestone's version as the version pattern reads it from its
// title, and fixed words reach it. Two sentences from the one count: the human's says "you", Claude's "the human".
// No disk, clock, network or process.

import { nounFor, plural, versionOf } from "../../_text.mjs";
import { describeFailure } from "../../_tracker-failure-kinds.mjs";
import { SET_ASIDE_WORDS, labelWaiting } from "./waiting-words.mjs";

const SHOWN = 10; // issue numbers named per count; the rest counted

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

// Where the counts come from when the read was not live: the failed read named by its kind, in the words The Road's
// page says it (describeFailure), and whether a snapshot stands in; "" for a live read.
function sourceOf({ live, snapshot, failure }) {
  if (live) return "";
  const unread = `the tracker could not be read${failure ? ` (${describeFailure(failure)})` : ""}`;
  return snapshot ? `${unread}; these counts are from the last snapshot` : `${unread}, and there is no snapshot`;
}

// The session-start line from `road`, the road model, and `read`, how the tracker was read: { live, snapshot,
// failure }, whether the read was live, whether a snapshot was read, and a failed read's kind (FAILURE_KIND). { shown,
// given }: the human's sentence and Claude's, both from the one model so they never disagree on a number; both null
// when there is nothing to say.
export function sessionLine(road, read) {
  const source = sourceOf(read);
  return { shown: makeSentence(road, source, TO_HUMAN), given: makeSentence(road, source, TO_CLAUDE) };
}
