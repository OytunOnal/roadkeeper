// @level domain
// Roadkeeper — the text helpers the structure scripts print through: the repository's text made printable, a level
// list cut, a group of lines capped, a reader's message cleaned.

import { controlsReplaced } from "../../_text.mjs";

// The repository's text as it may be printed into an agent's report: letters, digits, `/ . _ -` and the characters
// `keep` names only, anything else `?`, at most `max` characters — every structure script prints through it. 300 keeps
// a line readable; a longer path is cut, its start enough to find it
export const printable = (s, { max = 300, keep = "" } = {}) => {
  const allowed = new RegExp(`[^\\p{L}\\p{N}/._${keep.replace(/[\\\]^-]/g, "\\$&")}-]`, "gu");
  const t = String(s == null ? "" : s).replace(allowed, "?");
  return t.length > max ? t.slice(0, max) + "…" : t;
};
// a level list as a line or a drawing prints it: each name printed through `printable`, the whole cut at printable's
// own length, so its start names the levels
const SHOWN_LEVELS = 300;
export const cutLevels = (levels, sep) => {
  const t = levels.map((l) => printable(l)).join(sep);
  return t.length > SHOWN_LEVELS ? t.slice(0, SHOWN_LEVELS) + "…" : t;
};
// lines per group a report prints: enough to act on, few enough that a hard line is never buried behind judgements; the
// rest counted
export const GROUP = 200;
export const grouped = (lines, cap = GROUP) => lines.length > cap ? [...lines.slice(0, cap), `          and ${lines.length - cap} more`] : lines;
// a reader's message: its own words kept, control, format and separator characters gone, the repository's text — the
// reader quotes it in backticks — cut to printable
export const readerMessage = (s) => controlsReplaced(s).replace(/`([^`]*)`/g, (_, x) => "`" + printable(x) + "`");
