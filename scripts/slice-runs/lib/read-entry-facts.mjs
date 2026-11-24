// @level infrastructure
// Roadkeeper — a Claude Code transcript's entry read as the facts the counts take: whether it is a message or a call,
// the assistant's, typed by the owner or the session resuming an agent; its tool calls; its tool results, each with
// its outcome and, in error, its failure's kind by how it opens; the end of a call a task notification names; and the
// hook a lint fix comes from. Only these readers know how Claude Code writes an entry.

import { findToolCalls, findToolResults, readResultText } from "./entry-parts.mjs";

const COMMAND_CAP = 10000; // characters of a call's command read: a command run by hand is a line or a few
const EXIT = /^Exit code (\d{1,3})/; // a shell call's error result opening when its command exited non-zero
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
const REFUSAL = /^PreToolUse:\S+ hook error: (?=\[)/; // a refusal's opening, its hook's message after it
const HOOK_SAID = /^\[([^\]\n]*)\]: ([^\n]*)/; // a hook's message: its command or number in brackets, then its words
const NUMBERED = /^command hook \d+$/; // a bracket naming the hook by its number, its name then in its words
const EXITED = "Exit code"; // a shell call's result opening when its command exited non-zero
// how a denied call's result opens: auto mode's denial, or a permission answer, the owner's or a permission rule's
const DENIED = ["The server-side auto mode classifier", "Permission for this", "The user doesn't want to proceed", "The user did not allow"];
// how a line Claude Code writes as the user's opens when the owner did not type it
const NOT_TYPED = ["<task-notification", "<local-command", "<system-reminder", "<bash-stdout"];
const RESUMED_BY = "coordinator"; // the origin kind of the session's message resuming an agent that handed back
const QUESTION_BOX = "AskUserQuestion"; // the tool showing the owner Claude Code's question box

// A hook's name from its message: a command's script file named without its folder and extension, else the last word
// before the words' first colon ("[command hook 3]: roadkeeper shell-block: …" names shell-block).
function readHookName(said) {
  const [, bracket, words] = HOOK_SAID.exec(said) || [null, "command hook 0", ""];
  if (!NUMBERED.test(bracket)) {
    const script = bracket.trim().split(/\s+/).pop().split(/[\\/]/).pop();
    return script.replace(/\.[^.]*$/, "");
  }
  const before = words.split(":")[0].trim().split(/\s+/);
  return before[before.length - 1] || "unnamed";
}

// An error result's kind by its opening: a hook's refusal, a shell command exited non-zero, a call denied, else the
// tool's own error: "refused", "exited", "denied" or "toolErrors".
function classifyFailedResult(text) {
  if (REFUSAL.test(text)) return "refused";
  if (text.startsWith(EXITED)) return "exited";
  return DENIED.some((opening) => text.startsWith(opening)) ? "denied" : "toolErrors";
}

// a lint fix's message: a PostToolUse hook's blocking error attached after a write, else null
function readLintMessage(entry) {
  const attachment = entry.type === "attachment" && entry.attachment;
  const isLint = attachment && attachment.type === "hook_blocking_error" && attachment.hookEvent === "PostToolUse";
  const blocking = isLint && attachment.blockingError;
  return blocking && typeof blocking.blockingError === "string" ? blocking.blockingError : null;
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

// a tool call's facts: its id as written, whether it opens the question box, its shell command cut to its cap (null
// with none), and its tool's name and input as one text
const readCall = (part) => ({
  id: part.id,
  isQuestionBox: part.name === QUESTION_BOX,
  command: part.input && typeof part.input.command === "string" ? part.input.command.slice(0, COMMAND_CAP) : null,
  input: `${part.name} ${JSON.stringify(part.input)}`,
});

// a tool result's facts: its call's id, whether it is in error, its text, its outcome, whether it says its command went
// to the background, and, in error, its failure's kind (classifyFailedResult) and, refused, the refusing hook's name
function readResult(part) {
  const isError = part.is_error === true;
  const text = readResultText(part.content);
  const failure = isError ? classifyFailedResult(text) : null;
  return { id: part.tool_use_id, isError, text, outcome: readOutcome(part), failure,
    isBackground: !isError && BACKGROUND.some((opening) => text.startsWith(opening)),
    refusedBy: failure === "refused" ? readHookName(text.replace(REFUSAL, "")) : null };
}

// One entry's facts: { isMessageOrCall, isAssistant, isTyped, isResume, calls, results, notified, lintBy }, `calls`
// its tool calls (readCall's), `results` its tool results (readResult's), `notified` the end a task notification
// names ({ id, outcome, outputFile }) or null, `lintBy` the hook a lint fix comes from or null.
function readEntry(entry) {
  const notification = readNotification(entry);
  const lint = readLintMessage(entry);
  return {
    isMessageOrCall: entry.type === "user" || entry.type === "assistant",
    isAssistant: entry.type === "assistant",
    isTyped: isTyped(entry),
    isResume: isResume(entry),
    calls: findToolCalls(entry).map(readCall),
    results: findToolResults(entry).map(readResult),
    notified: notification === null ? null : parseNotifiedEnd(notification),
    lintBy: lint === null ? null : readHookName(lint),
  };
}

// A run's entries ({ entry, time }, in the file's order) as the counts take them: each { time, ...its facts }
// (readEntry's).
export const readEntryFacts = (entries) => entries.map(({ entry, time }) => ({ time, ...readEntry(entry) }));
