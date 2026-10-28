// @level domain
// Roadkeeper — what the scripts and hooks share about text: escaping, cutting and lines; dates; versions.

// ------------------------------------------------------------------ text

export const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Self-contained: the Architecture tab embeds it into its page by its source text.
export function plural(n, one, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

// A count as a page says it, never a bare 0: `zero` at 0; else the number, with plural's noun when `one` is given. The
// Architecture tab embeds it beside plural.
export function countInWords(n, zero, one) {
  if (!n) return zero;
  return one ? plural(n, one) : String(n);
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
const IN_LINE = /[\u2028\u2029]/g;
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
  return { fence: f.ch === fence.ch && f.len >= fence.len && f.info === "" ? null : fence, isFence: true };
}

// ------------------------------------------------------------------ dates

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

// ------------------------------------------------------------------ versions

export const VERSION_TOKEN = /^v\d+(?:\.\d+)*$/i;

// a version token's numbers, part by part: `v2.2` → [2, 2]
export const versionNumbers = (v) => v.slice(1).split(".").map(Number);

// two version tokens, compared part by part: v0.10 is after v0.9
export function compareVersions(a, b) {
  const x = versionNumbers(a), y = versionNumbers(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}

// the version a milestone's title opens with (`v2.0 — Roadkeeper runs on the tracker` → `v2.0`), or null
export const versionOf = (title) => { const m = /^\s*(v\d+(?:\.\d+)*)/i.exec(title || ""); return m ? m[1] : null; };
