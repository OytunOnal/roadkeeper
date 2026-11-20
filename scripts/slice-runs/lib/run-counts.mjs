// @level domain
// Roadkeeper — one run's counts from its transcript's entries in the slice window: its calls, its seconds, and on a
// session's run the time it waited on the owner.

import { findCallIds, findToolCalls, findToolResults } from "./entry-parts.mjs";

const MILLISECONDS = 1000; // in a second
// how a line Claude Code writes as the user's opens when the owner did not type it
const NOT_TYPED = ["<task-notification", "<local-command", "<system-reminder", "<bash-stdout"];
const RESUMED_BY = "coordinator"; // the origin kind of the session's message resuming an agent that handed back
const QUESTION_BOX = "AskUserQuestion"; // the tool showing the owner Claude Code's question box

// the count of tool calls an assistant entry makes
const countCalls = (entry) => findToolCalls(entry).length;

// Whether an entry is one the counts read: a message or a call, the user's or the assistant's.
export const isMessageOrCall = (entry) => entry.type === "user" || entry.type === "assistant";

// Milliseconds as whole seconds, rounded.
export const toSeconds = (milliseconds) => Math.round(milliseconds / MILLISECONDS);

// The counts of a run whose `entries` ({ entry, time }, in the file's order) fall in the window: { calls, seconds },
// its seconds from its first entry to its last.
export function countRun(entries) {
  const calls = entries.reduce((sum, { entry }) => sum + countCalls(entry), 0);
  return { calls, seconds: entries.length ? toSeconds(entries[entries.length - 1].time - entries[0].time) : 0 };
}

// the text of a user entry's message when it is text alone, else null
function readMessageText(entry) {
  const content = entry.message && entry.message.content;
  if (typeof content === "string") return content;
  const isTextAlone = Array.isArray(content) && content.length > 0 && content.every((part) => part && part.type === "text");
  return isTextAlone ? content.map((part) => String(part.text || "")).join(" ") : null;
}

// Whether the owner typed the entry: a user's text, not a tool result, a task notification, a command's own lines,
// the output of the owner's own `!` command, a reminder, a meta line or a compact's summary.
function isTyped(entry) {
  const isWrittenByClaudeCode = entry.isMeta || entry.isCompactSummary;
  if (entry.type !== "user" || isWrittenByClaudeCode) return false;
  const text = (readMessageText(entry) || "").trimStart();
  return text !== "" && !NOT_TYPED.some((opening) => text.startsWith(opening));
}

// Whether the entry is the session's message resuming an agent that handed back: a meta user message from the
// coordinator.
function isResume(entry) {
  const isFromCoordinator = Boolean(entry.origin) && entry.origin.kind === RESUMED_BY;
  return entry.type === "user" && entry.isMeta === true && isFromCoordinator;
}

// A count of waits: `add` counts one of so many milliseconds; `total` gives { waited, waits }, waited in seconds.
function startWaitCount() {
  let waited = 0;
  let waits = 0;
  return { add: (milliseconds) => { waited += milliseconds; waits += 1; }, total: () => ({ waited: toSeconds(waited), waits }) };
}

// An agent's time waiting on the owner: the gaps from its last assistant entry, its hand-back, to each message of the
// session resuming it. { waited, waits }, waited in seconds.
export function countAgentWaits(entries) {
  const count = startWaitCount();
  let handedBack = null;
  for (const { entry, time } of entries) {
    if (isResume(entry) && handedBack !== null) { count.add(time - handedBack); handedBack = null; }
    if (entry.type === "assistant") handedBack = time;
  }
  return count.total();
}

// the ids of the question-box calls an assistant entry makes
const findQuestionBoxIds = (entry) => findCallIds(entry, (call) => call.name === QUESTION_BOX);

// A session's time waiting on the owner: each question box's time from its call to its answer, declined or not, and
// each gap before a message the owner typed, from the latest of the session's last assistant entry, the owner's own
// message before it and a box's answer. Claude Code's own lines, written while the session sits idle, start no wait.
// { waited, waits }, waited in seconds.
export function countWaits(entries) {
  const count = startWaitCount();
  let waitStart = null; // when a wait before the owner's next message would start
  const openedAt = new Map(); // the question boxes not yet answered, by call id: when each opened
  for (const { entry, time } of entries) {
    for (const answer of findToolResults(entry).filter((part) => openedAt.has(part.tool_use_id))) {
      count.add(time - openedAt.get(answer.tool_use_id));
      openedAt.delete(answer.tool_use_id);
      waitStart = time;
    }
    if (isTyped(entry)) { if (waitStart !== null) count.add(time - waitStart); waitStart = time; }
    if (entry.type !== "assistant") continue;
    waitStart = time;
    for (const id of findQuestionBoxIds(entry)) openedAt.set(id, time);
  }
  return count.total();
}
