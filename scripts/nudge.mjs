#!/usr/bin/env node
// @level main
// Roadkeeper — the nudge (SessionStart hook).
//
// In a project with docs/roadkeeper/, reads the tracker into the snapshot docs/roadkeeper/issues.json, redraws The Road from it
// on the default branch, then says in one line what The Road's model (scripts/road/) counts from the snapshot and
// docs/roadkeeper/metrics.md: the current milestone when it is ready to close, the open issues no one has triaged, today's
// waiting-on-you issues with how many are late and the oldest known age, those set aside (waiting on something else
// first) apart, and the metric readings that are due. The counts are the model's; the words are the nudge's. Only
// counts, issue numbers, metric row ids, a milestone's version as the version pattern reads it from its title, and
// fixed words reach the context. Two sentences from the one count: the human's (systemMessage) says "you", Claude's
// (additionalContext) "the human". Silent when there is nothing to say. Always exits 0.

import { fileURLToPath } from "node:url";
import { todayLocal } from "./_clock.mjs";
import { recordsDir } from "./_files.mjs";
import { nounFor, plural, versionOf } from "./_text.mjs";
import { readTracker } from "./_tracker.mjs";
import { roadModel } from "./road/road.mjs";
import { drawRoadAtHome, readInput, repoRoot } from "./_hook.mjs";

const ROAD = fileURLToPath(new URL("./road.mjs", import.meta.url)); // found from this file: a hook runs anywhere
const TRACKER_BUDGET = 40000; // milliseconds for the tracker; the hook has 60
const DRAW_TIMEOUT = 15000;   // milliseconds for the page
const SHOWN = 10; // issue numbers named per count; the rest counted
const NO_ISSUES = { issues: [], milestones: [] }; // the snapshot modelled when there is none

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
  return `${plural(open.length, "issue waits", "issues wait")} on ${wording.waitsOn} (${numbers(open)})${lateClause}${oldest}`;
}

// the set-aside clause: the waiting-on-you issues that wait on something else first, never counted late or aged;
// the option `more` says "more" after a waiting clause
function makeAsideClause(setAside, { more = false } = {}) {
  const lead = more ? "more " : "";
  return `${plural(setAside.length, `${lead}waits`, `${lead}wait`)} on something first (${numbers(setAside)})`;
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

function main() {
  const input = readInput();
  const root = repoRoot(input.cwd || process.cwd());
  if (!root || !recordsDir(root)) return;

  const { snap, live } = readTracker(root, false, TRACKER_BUDGET);
  // the outcome goes unsaid: the page is The Road's to report, and the counts stand either way
  drawRoadAtHome(root, ROAD, { offline: true, timeout: DRAW_TIMEOUT });

  // with no snapshot the issues count none, and the due readings still count
  const road = roadModel(root, snap || NO_ISSUES, todayLocal());
  let source = "";
  if (!live) source = snap ? "the tracker could not be read; these counts are from the last snapshot" : "the tracker could not be read, and there is no snapshot";
  // both sentences from the one model, so they never disagree on a number
  const shown = makeSentence(road, source, TO_HUMAN);
  if (!shown) return;
  process.stdout.write(JSON.stringify({
    systemMessage: shown,
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: makeSentence(road, source, TO_CLAUDE) },
  }) + "\n");
}

try { main(); } catch { /* a nudge never stops a session */ }
