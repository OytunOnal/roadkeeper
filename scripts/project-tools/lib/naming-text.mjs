// @level domain
// Roadkeeper — the naming text: a file's text with what names nothing dropped before the reader rule matches it
// (reader-rule.mjs), read by its kind (source-lexing.mjs): a Python or JS/TS file's comments, and a Python file's
// docstrings. Pure: the texts are the caller's.

import { replaceParts, sourceParts } from "./source-lexing.mjs";

// The text of the file at `path` with what names nothing dropped, read by its kind: a Python file's comments and
// docstrings, a JS or TS file's comments, each put out by a space; any other file's text whole.
export function namingText(path, text) {
  const { comments, docstrings } = sourceParts(path, text);
  const unnaming = [...comments, ...docstrings].sort((a, b) => a[0] - b[0]);
  return replaceParts(text, unnaming, () => " ");
}
