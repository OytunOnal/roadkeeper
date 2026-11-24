// @level infrastructure
// Roadkeeper — the parts of a Claude Code transcript's entry its facts are read from (read-entry-facts.mjs): its
// message's parts of one type, its tool calls, its tool results, and a tool result's text.

// The parts of an entry's message of `type`; none when its content is no list.
function findParts(entry, type) {
  const content = entry.message && entry.message.content;
  return Array.isArray(content) ? content.filter((part) => part && part.type === type) : [];
}

// The tool calls an assistant entry makes, its `tool_use` parts; none for any other entry.
export const findToolCalls = (entry) => (entry.type === "assistant" ? findParts(entry, "tool_use") : []);

// The tool results a user entry carries, its `tool_result` parts; none for any other entry.
export const findToolResults = (entry) => (entry.type === "user" ? findParts(entry, "tool_result") : []);

// The text of a tool result's content: a string, or the text of its parts.
export function readResultText(content) {
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.map((part) => (part && typeof part.text === "string" ? part.text : "")).join(" ") : "";
}
