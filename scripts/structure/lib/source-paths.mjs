// @level domain
// Roadkeeper — the source-path helpers: which files are read as code, a glob against a path, and a path under another,
// by whole segments.

// a script's endings: JavaScript and TypeScript, as dependency-cruiser and the compiler parse them, and Astro
const SCRIPT_ENDINGS = "[cm]?[jt]s|[jt]sx|astro";
// the files the script parser takes
const SCRIPT = new RegExp(`\\.(?:${SCRIPT_ENDINGS})$`);
// the files read as code: the scripts and Python
export const SOURCE = new RegExp(`\\.(?:${SCRIPT_ENDINGS}|py)$`);
export const isCodeEdge =(e) => SOURCE.test(e.from) && SOURCE.test(e.to); // the only edges the check rules and the tab draws
export const isScript = (file) => SCRIPT.test(file);
export const isAstro = (file) => file.endsWith(".astro");
export const isPython = (file) => file.endsWith(".py");
// one path under another, by whole segments: `src/a/b` is under `src/a`, `src/ab` is not
export const underPath = (child, ancestor) => child === ancestor || child.startsWith(ancestor + "/");
// a module's owner is found by walking up a path's folders, so a path's cost is its depth times its length
export const MAX_DEPTH = 64;
// A path, then each folder above it, by whole segments: `src/a/b.ts`, `src/a`, `src`; at most MAX_DEPTH + 1 of them, a
// path of MAX_DEPTH slashes and each folder above it. Every "the deepest X above this path" walk goes through here.
export function* pathAndParents(p) {
  for (let i = p.length, n = 0; i > 0 && n <= MAX_DEPTH; i = p.lastIndexOf("/", i - 1), n++) yield p.slice(0, i);
}
// One path segment against one pattern segment, `*` matching any run of characters: the pattern split at its stars, the
// first piece a prefix, the last a suffix, the middle ones found left to right — a few indexOf calls, no backtracking
// and no regex built from the repository's text.
function segmentMatch(p, s) {
  const parts = p.split("*");
  if (parts.length === 1) return p === s;
  const first = parts[0], last = parts[parts.length - 1];
  if (s.length < first.length + last.length || !s.startsWith(first) || !s.endsWith(last)) return false;
  let at = first.length;
  const end = s.length - last.length;
  for (let i = 1; i < parts.length - 1; i++) {
    if (!parts[i]) continue;
    const k = s.indexOf(parts[i], at);
    if (k < 0 || k + parts[i].length > end) return false;
    at = k + parts[i].length;
  }
  return true;
}
// A path against a pattern of segments, `**` matching any number of whole segments: a table of segments × segments.
export function globMatch(pattern, path) {
  const ps = pattern.split("/"), ss = path.split("/");
  let row = new Array(ss.length + 1).fill(false);
  row[0] = true;
  for (let i = 0; i < ps.length; i++) {
    const next = new Array(ss.length + 1).fill(false);
    for (let j = 0; j <= ss.length; j++) {
      if (ps[i] === "**") next[j] = row[j] || (j > 0 && next[j - 1]);
      else next[j] = j > 0 && row[j - 1] && segmentMatch(ps[i], ss[j - 1]);
    }
    row = next;
  }
  return row[ss.length];
}
