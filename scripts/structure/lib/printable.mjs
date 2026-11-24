// @level kernel
// Roadkeeper — the text helpers the structure scripts print through: the repository's text made printable, a reader's
// message cleaned. A level list cut and a group of lines capped are cut-lines.mjs's.

import { controlsReplaced } from "../../_text.mjs";

// The repository's text as it may be printed into an agent's report: letters, digits, `/ . _ -` and the characters
// `keep` names only, anything else `?`, at most `max` characters — every structure script prints through it. 300 keeps
// a line readable; a longer path is cut, its start enough to find it
export const printable = (s, { max = 300, keep = "" } = {}) => {
  const allowed = new RegExp(`[^\\p{L}\\p{N}/._${keep.replace(/[\\\]^-]/g, "\\$&")}-]`, "gu");
  const t = String(s == null ? "" : s).replace(allowed, "?");
  return t.length > max ? t.slice(0, max) + "…" : t;
};
// a reader's message: its own words kept, control, format and separator characters gone, the repository's text — the
// reader quotes it in backticks — cut to printable
export const readerMessage = (s) => controlsReplaced(s).replace(/`([^`]*)`/g, (_, x) => "`" + printable(x) + "`");
