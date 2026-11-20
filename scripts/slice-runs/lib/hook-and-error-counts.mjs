// @level domain
// Roadkeeper — one run's hook refusals (GLOSSARY.md) and lint fixes, counted by hook, and its failed calls by kind,
// from its transcript's entries in the slice window: each error result is a refusal, an exit non-zero, a denial or a
// tool error, by how it opens, and nothing a text only mentions counts.

import { findToolCalls, findToolResults, readResultText } from "./entry-parts.mjs";

const REFUSAL = /^PreToolUse:\S+ hook error: (?=\[)/; // a refusal's opening, its hook's message after it
const HOOK_SAID = /^\[([^\]\n]*)\]: ([^\n]*)/; // a hook's message: its command or number in brackets, then its words
const NUMBERED = /^command hook \d+$/; // a bracket naming the hook by its number, its name then in its words
const EXITED = "Exit code"; // a shell call's result opening when its command exited non-zero
// how a denied call's result opens: auto mode's denial, or a permission answer, the owner's or a permission rule's
const DENIED = ["The server-side auto mode classifier", "Permission for this", "The user doesn't want to proceed", "The user did not allow"];

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

// each tool result an entry holds in error: { text, id }, id its call's
const findErrorResults = (entry) => findToolResults(entry)
  .filter((part) => part.is_error === true).map((part) => ({ text: readResultText(part.content), id: part.tool_use_id }));

// each call an assistant entry makes: { id, input }, input its tool's name and its input as one text
const findCallInputs = (entry) => findToolCalls(entry)
  .map((part) => ({ id: part.id, input: `${part.name} ${JSON.stringify(part.input)}` }));

// a lint fix's message: a PostToolUse hook's blocking error attached after a write, else null
function readLintMessage(entry) {
  const attachment = entry.type === "attachment" && entry.attachment;
  const isLint = attachment && attachment.type === "hook_blocking_error" && attachment.hookEvent === "PostToolUse";
  const blocking = isLint && attachment.blockingError;
  return blocking && typeof blocking.blockingError === "string" ? blocking.blockingError : null;
}

// a new Map from each of `names` to how often it comes
function countEach(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  return counts;
}

// An error result's kind by its opening: a hook's refusal, a shell command exited non-zero, a call denied, else the
// tool's own error: "refused", "exited", "denied" or "toolErrors".
export function classifyFailedResult(text) {
  if (REFUSAL.test(text)) return "refused";
  if (text.startsWith(EXITED)) return "exited";
  return DENIED.some((opening) => text.startsWith(opening)) ? "denied" : "toolErrors";
}

// The hooks and failed calls of a run whose `entries` ({ entry, time }) fall in the window: { refused, lintFixes },
// each a Map from a hook's name to its count; { exited, denied, toolErrors }, the failed calls by kind; and
// { repeated }, the inputs of calls in the window failing more than once, of any kind.
export function countHooksAndErrors(entries) {
  const refusedBy = []; // each refusal's hook
  const lintedBy = []; // each lint fix's hook
  const kinds = []; // each other failure's kind
  const inputs = new Map(); // each call's id to its input
  const failedInputs = []; // each failure's input, when its call is in the window
  for (const { entry } of entries) {
    const lint = readLintMessage(entry);
    if (lint !== null) lintedBy.push(readHookName(lint));
    for (const { id, input } of findCallInputs(entry)) inputs.set(id, input);
    for (const { text, id } of findErrorResults(entry)) {
      const kind = classifyFailedResult(text);
      if (kind === "refused") refusedBy.push(readHookName(text.replace(REFUSAL, "")));
      else kinds.push(kind);
      if (inputs.has(id)) failedInputs.push(inputs.get(id));
    }
  }
  const failed = countEach(kinds);
  const repeated = [...countEach(failedInputs).values()].filter((n) => n > 1).length;
  return { refused: countEach(refusedBy), lintFixes: countEach(lintedBy), exited: failed.get("exited") || 0, denied: failed.get("denied") || 0,
    toolErrors: failed.get("toolErrors") || 0, repeated };
}
