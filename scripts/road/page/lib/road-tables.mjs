// @level presentation
// Roadkeeper — The Road's two tables under the rail: Versions, every milestone with its state and what it can do, and
// Bets, each open issue's bet with its version, under a line saying how many name one; drawn from the road model, with
// no decisions of their own.
//
// Tracker text is a stranger's: every title, name and bet is escaped.

import { escapeHtml } from "../../../_words.mjs";
import { dayOf } from "../../lib/road-model.mjs";
import { inline } from "./markdown-subset.mjs";
import { READY_TO_CLOSE_LINK, closeSaid, issueTitleLink } from "./road-words.mjs";

// A version's row: its number, its state (closed and its close date, or where an open one stands), as HTML, and its
// name.
const versionRow = (m, state) => `<tr><td class="num">${escapeHtml(m.version)}</td><td class="num">${state}</td><td>${inline(m.name || m.description)}</td></tr>`;

// A closed version's state: "released on" from v1 on, "closed on" before, and its close date, when it has one.
const closedState = (m) => escapeHtml(closeSaid(m.marker, dayOf(m.closedAt)));

// Where an open version stands: planned, or ready to close; the current one's linked to the bar, whose line says who
// closes it.
function openState(m) {
  if (!m.readyToClose) return "planned";
  return m.current ? READY_TO_CLOSE_LINK : "ready to close";
}

export function renderVersionsTable(road) {
  const ms = road.milestones;
  const rows = [
    ...ms.closed.map((m) => versionRow(m, closedState(m))),
    ...ms.open.map((m) => versionRow(m, openState(m))),
  ];
  if (!rows.length) return "";
  return `<h2>Versions</h2><div class="scroll"><table><tr><th>Version</th><th>State</th><th>What it can do</th></tr>${rows.join("")}</table></div>`;
}

// How many of the `poolSize` open issues name a bet, `betCount` of them, at least one: the noun agreeing with the pool,
// the verb with `betCount`; all of them said "All", the pool's one "The one".
function sayBetCount(betCount, poolSize) {
  if (poolSize === 1) return "The one open issue names a bet: what must be true for it to be worth building.";
  const which = betCount === poolSize ? `All ${poolSize}` : `${betCount} of ${poolSize}`;
  return `${which} open issues ${betCount === 1 ? "names" : "name"} a bet: what must be true for each to be worth building.`;
}

// The bets table, under a line saying how many of the open issues it draws from name a bet.
export function renderBets(road) {
  if (!road.bets.length) return "";
  const rows = road.bets.map((b) => `<tr><td>${issueTitleLink(b.issue)}</td><td>${inline(b.bet)}</td><td class="num">${escapeHtml(b.version || "no milestone yet")}</td></tr>`).join("");
  const says = `<p class="s">${sayBetCount(road.bets.length, road.betPoolSize)}</p>`;
  return `<h2>Bets the road rests on</h2>${says}<div class="scroll"><table><tr><th>Issue</th><th>The bet</th><th>Version</th></tr>${rows}</table></div>`;
}
