#!/usr/bin/env node
// @level main
// Roadkeeper — the nudge (SessionStart hook).
//
// In a project with docs/roadkeeper/, reads from the tracker what its line counts, within the hook's time and writing no
// snapshot (scripts/_tracker.mjs, readTrackerForCounts), or, when that read fails, the snapshot docs/roadkeeper/issues.json;
// redraws The Road from the snapshot on the default branch; then says in one line what The Road's model (scripts/road/)
// counts from that read and docs/roadkeeper/metrics.md: the current milestone when it is ready to close, the open issues no one has triaged, today's
// waiting-on-you issues with how many are late and the oldest known age, those set aside (waiting on something else
// first) apart, and the metric readings that are due: The Road's session line (scripts/road/road.mjs, sessionLine),
// the human's sentence as systemMessage, Claude's as additionalContext. Silent when there is nothing to say. Always
// exits 0.

import { fileURLToPath } from "node:url";
import { todayLocal } from "./_clock.mjs";
import { recordsDir } from "./_files.mjs";
import { readTrackerForCounts } from "./_tracker.mjs";
import { roadModel, sessionLine } from "./road/road.mjs";
import { drawRoadAtHome, readInput, repoRoot } from "./_hook.mjs";

const ROAD = fileURLToPath(new URL("./road.mjs", import.meta.url)); // found from this file: a hook runs anywhere
const TRACKER_BUDGET = 40000; // milliseconds for the tracker; the hook has 60
const DRAW_TIMEOUT = 15000;   // milliseconds for the page
const NO_ISSUES = { issues: [], milestones: [] }; // the snapshot modelled when there is none

function main() {
  const input = readInput();
  const root = repoRoot(input.cwd || process.cwd());
  if (!root || !recordsDir(root)) return;

  const { snap, live, failure } = readTrackerForCounts(root, TRACKER_BUDGET);
  // the outcome goes unsaid: the page is The Road's to report, and the counts stand either way
  drawRoadAtHome(root, ROAD, { offline: true, timeout: DRAW_TIMEOUT });

  // with no snapshot the issues count none, and the due readings still count
  const today = todayLocal();
  const road = roadModel(root, snap || NO_ISSUES, today);
  // the snapshot's time as its file holds it, so the line names its day and age
  const { shown, given } = sessionLine(road, { live, snapshot: snap && { fetched: snap.fetched }, failure, today });
  if (!shown) return;
  process.stdout.write(JSON.stringify({
    systemMessage: shown,
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: given },
  }) + "\n");
}

try { main(); } catch { /* a nudge never stops a session */ }
