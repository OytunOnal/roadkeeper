// @level domain
// Roadkeeper — a path from a structure file read as the structure's readers read it, and a value quoted in their
// messages: what structure-model.mjs and dependency-rules.mjs share. Every value is taken only if it is a string.

import { MAX_DEPTH } from "./path-match.mjs";

// a path is the repository's own, as the tools print it from the root: no leading `/`, no `.`/`..` or empty segment,
// no colon (a drive or a scheme) and no space at either end
const NOT_RELATIVE = /^(?:\/|\.\.?(?:\/|$))|\/\.\.?(?:\/|$)|\/\/|:|^\s|\s$/;
// a path's depth is capped (MAX_DEPTH), and its length too: V8 hashes a string past 16 383 characters by its length
// alone, so long paths collide in the owner lookup
export const MAX_PATH = 1024;
// a message quotes at most this much of the repository's text
export const SHOWN = 200;

// a value quoted in a message: its backticks become `'`, so every backtick pair in a message is the reader's own and
// the repository's text is exactly what they hold
export const shown = (s) => { const t = String(s).replace(/`/g, "'"); return t.length > SHOWN ? t.slice(0, SHOWN) + "…" : t; };

// A path from a structure file read as the reader reads it, for the stamp that writes structure.json back too:
// { path, why: null }, or { path: null, why } saying what it is not.
export function structurePath(v) {
  if (typeof v !== "string") return { path: null, why: "is not a string" };
  let p = v.replace(/\\/g, "/");
  let end = p.length;
  while (end > 0 && p[end - 1] === "/") end--;
  p = p.slice(0, end);
  if (!p) return { path: null, why: "is empty" };
  if (p.length > MAX_PATH) return { path: null, why: `\`${shown(p)}\` is longer than ${MAX_PATH} characters` };
  if (NOT_RELATIVE.test(p)) return { path: null, why: `\`${shown(p)}\` is not a repository-relative path (forward slashes; no ., .. or empty segment; no colon; no space at either end)` };
  if (p.split("/").length - 1 > MAX_DEPTH) return { path: null, why: `\`${shown(p)}\` is deeper than ${MAX_DEPTH} folders` };
  return { path: p, why: null };
}

// a line's two ends read as paths: { from, to }, or { why } saying the first that does not read
export function endsRead(a, b) {
  const f = structurePath(a), t = structurePath(b);
  return f.why || t.why ? { why: `a path ${f.why || t.why}` } : { from: f.path, to: t.path };
}
