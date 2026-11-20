// @level domain
// Roadkeeper — one run's calls of a kind of command, from its transcript's entries in the slice window: each a shell
// call whose command a test picks, ended by its own result, or, when that result says it went to the background, by
// the task notification naming its call; its seconds from the call to that end, its outcome the exit code. A call a
// hook refused, or auto mode or the owner denied, never ran, and is none.

import { findCallIds, findToolResults, readResultText } from "./entry-parts.mjs";
import { classifyFailedResult } from "./hook-and-error-counts.mjs";
import { toSeconds } from "./run-counts.mjs";

const COMMAND_CAP = 10000; // characters of a call's command read: a command run by hand is a line or a few
const EXIT = /^Exit code (\d{1,3})/; // a shell call's error result opening when its command exited non-zero
const NEVER_RUN = new Set(["refused", "denied"]); // the failure kinds of a call stopped before it ran
// a result's opening when its command went to the background: started there, or moved there past the call's cap
const BACKGROUND = ["Command running in background with ID:", "Command was moved to the background (ID:"];
const NOTIFICATION = "<task-notification>"; // a task notification's opening
const SYSTEM_NOTICE = "[SYSTEM NOTIFICATION - NOT USER INPUT]\n"; // how Claude Code opens a notification it gives an agent
const NOTICE_CAP = 2000; // characters searched for the notification after the notice: Claude Code's notice is 494
const NOTIFIED_ORIGIN = "task-notification"; // the origin kind of an entry Claude Code writes from a task notification
const NOTIFIED_CALL = /<tool-use-id>([^<\s]{1,200})<\/tool-use-id>/; // the call a notification names
const NOTIFIED_EXIT = /<summary>[^<]*exit code (\d{1,3})\)?<\/summary>/; // its command's exit code, in its summary
const NOTIFIED_STATUS = /<status>([a-z_]{1,20})<\/status>/; // its task's status: completed, failed, killed
const NOTIFIED_OUTPUT = /<output-file>([^<\n]{1,1000})<\/output-file>/; // the file its command's output went to

// the ids of the calls an assistant entry makes whose command, cut to its cap, `isPicked` says yes to
const findPickedCalls = (entry, isPicked) => findCallIds(entry,
  (part) => Boolean(part.input) && typeof part.input.command === "string" && isPicked(part.input.command.slice(0, COMMAND_CAP)));

// a result's outcome: exit 0, the exit code its error opens with, or error
function readOutcome(part) {
  if (part.is_error !== true) return "exit 0";
  const exit = EXIT.exec(readResultText(part.content));
  return exit ? `exit ${exit[1]}` : "error";
}

// the task notification after Claude Code's system notice, when the entry is an agent's meta entry from a task
// notification whose message opens with that notice; else null
function readNoticedNotification(entry) {
  const text = entry.message ? entry.message.content : null;
  const isFromNotification = entry.isMeta === true && Boolean(entry.origin) && entry.origin.kind === NOTIFIED_ORIGIN;
  const isNoticed = entry.type === "user" && isFromNotification && typeof text === "string" && text.startsWith(SYSTEM_NOTICE);
  const at = isNoticed ? text.slice(0, NOTICE_CAP).indexOf(`\n${NOTIFICATION}`) : -1;
  return at < 0 ? null : text.slice(at + 1);
}

// a task notification's text, when the entry is one: the user's message holding it alone, delivered during a turn a
// queued command's attachment, or an agent's meta entry after Claude Code's system notice
function readNotification(entry) {
  let text = null;
  const attachment = entry.type === "attachment" ? entry.attachment : null;
  if (entry.type === "user" && entry.message) text = entry.message.content;
  if (attachment && attachment.type === "queued_command") text = attachment.prompt;
  return typeof text === "string" && text.startsWith(NOTIFICATION) ? text : readNoticedNotification(entry);
}

// a notification's end of the call it names: { id, outcome, outputFile }, the outcome its exit code, else its status;
// outputFile the file it names, or null
function parseNotifiedEnd(text) {
  const id = NOTIFIED_CALL.exec(text);
  if (!id) return null;
  const exit = NOTIFIED_EXIT.exec(text);
  const status = NOTIFIED_STATUS.exec(text);
  const output = NOTIFIED_OUTPUT.exec(text);
  const outputFile = output ? output[1] : null;
  if (exit) return { id: id[1], outcome: `exit ${exit[1]}`, outputFile };
  return { id: id[1], outcome: status ? status[1] : "ended", outputFile };
}

// each end an entry holds: { id, outcome, printed, isBackground }, a result's, printing its text, or a notification's
function findEnds(entry) {
  const results = findToolResults(entry).map((part) => {
    const printed = readResultText(part.content);
    const isBackground = part.is_error !== true && BACKGROUND.some((opening) => printed.startsWith(opening));
    const isNeverRun = part.is_error === true && NEVER_RUN.has(classifyFailedResult(printed));
    return { id: part.tool_use_id, outcome: readOutcome(part), printed, outputFile: null, isBackground, isNeverRun };
  });
  const notification = readNotification(entry);
  const notified = notification === null ? null : parseNotifiedEnd(notification);
  return notified ? [...results, { ...notified, printed: null, isBackground: false }] : results;
}

// The calls of a run whose `entries` ({ entry, time }, in the file's order) fall in the window and whose command
// `isPicked` says yes to, in the order they were called: each { started, seconds, outcome, printed, outputFile },
// seconds and outcome null when no end is seen, printed its result's text, null for a notification's end or none,
// outputFile the file its notification names, else null.
export function findCommandRuns(entries, isPicked) {
  const runs = new Map(); // each call's id to its run
  for (const { entry, time } of entries) {
    for (const id of findPickedCalls(entry, isPicked)) runs.set(id, { started: time, seconds: null, outcome: null, printed: null, outputFile: null });
    for (const end of findEnds(entry)) {
      const run = runs.get(end.id);
      const isOpen = run && run.outcome === null;
      if (!isOpen || end.isBackground) continue;
      if (end.isNeverRun) { runs.delete(end.id); continue; }
      run.seconds = toSeconds(time - run.started);
      run.outcome = end.outcome;
      run.printed = end.printed;
      run.outputFile = end.outputFile;
    }
  }
  return [...runs.values()];
}
