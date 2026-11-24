// @level presentation
// Roadkeeper — how the structure scripts cut what they print: a level list cut, a group of lines capped and the rest
// counted.

import { printable } from "./printable.mjs";

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
