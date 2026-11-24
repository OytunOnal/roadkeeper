// @level kernel
// Roadkeeper — what the scripts and hooks share about text: escaping for a pattern, counts with their noun,
// cutting and lines; dates.

// ------------------------------------------------------------------ text

// A string as a regular expression matches it, literally: every character a pattern reads as syntax escaped.
export const escapeForPattern = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Self-contained: the Architecture tab embeds it into its page by its source text.
export function plural(n, one, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

// the word plural says beside a count of `n`, without the count
export const nounFor = (n, one, many = one + "s") => plural(n, one, many).slice(`${n} `.length);

// Cut a string at n UTF-16 units without splitting a surrogate pair: when the unit before the cut is a high surrogate,
// the cut moves one back.
export const cutAt = (s, n) => {
  if (s.length <= n) return s;
  const c = s.charCodeAt(n - 1);
  return s.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n);
};

// A stranger's text made printable on one line: control, format and separator characters as `?`.
export const controlsReplaced = (s) => String(s == null ? "" : s).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "?");

// A text's lines as CommonMark ends them (LF, CR, CRLF); U+2028 and U+2029 are characters inside a line, read as
// spaces; a leading byte-order mark is not part of line 1.
const LINE_END = /\r\n|\n|\r/;
const IN_LINE = /[\u2028\u2029]/g; // the two separators CommonMark reads inside a line
export const readerLines = (text) => String(text || "").replace(/^\uFEFF/, "").split(LINE_END).map((l) => l.replace(IN_LINE, " "));

// A fence line as CommonMark reads it: an opener is three or more of one marker and an info string (a backtick fence's
// carries no backtick); a closer is the same marker, at least as many, alone on its line. Indented, list-item and
// blockquote fences are not tracked. Read by hand in one pass, so a long run of backticks costs its length.
function fenceLine(line) {
  let i = 0;
  while (i < 4 && line[i] === " ") i++;
  if (i > 3) return null;
  const ch = line[i];
  if (ch !== "`" && ch !== "~") return null;
  let j = i;
  while (line[j] === ch) j++;
  if (j - i < 3) return null;
  const rest = line.slice(j);
  if (/[\r\n\u2028\u2029]/.test(rest)) return null;
  const info = rest.trim();
  if (ch === "`" && info.includes("`")) return null;
  return { ch, len: j - i, info };
}
// One line's step through fences: { fence, isFence } — the fence open after it, and whether the line was a fence line.
export function fenceStep(fence, line) {
  const f = fenceLine(line);
  if (!f) return { fence, isFence: false };
  if (!fence) return { fence: f, isFence: true };
  const closes = f.ch === fence.ch && f.len >= fence.len && f.info === "";
  return { fence: closes ? null : fence, isFence: true };
}

// ------------------------------------------------------------------ dates

// an ISO 8601 calendar date, YYYY-MM-DD, the one date shape the dates below read
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The three numbers of a DATE-shaped string, `{ y, m, d }`, or null.
export function dateParts(s) {
  const t = String(s || "");
  return DATE.test(t) ? { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)), d: Number(t.slice(8, 10)) } : null;
}

// A date the calendar has: `2026-02-31` has the shape and is not one. Set through setUTCFullYear, so a year under 100
// is that year.
export function isCalendarDate(s) {
  const p = dateParts(s);
  if (!p) return false;
  const t = new Date(0);
  t.setUTCFullYear(p.y, p.m - 1, p.d);
  return t.getUTCFullYear() === p.y && t.getUTCMonth() === p.m - 1 && t.getUTCDate() === p.d;
}

// whole days from one date to another, or null when either is not one
export function daysBetween(a, b) {
  const utc = (s) => { const d = dateParts(s); return d ? Date.UTC(d.y, d.m - 1, d.d) : null; };
  const x = utc(a), y = utc(b);
  return x === null || y === null ? null : Math.round((y - x) / 86400000);
}
