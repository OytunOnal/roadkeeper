// @level domain
// Roadkeeper — the declared structure: docs/roadkeeper/dependency-rules.md and structure.json read into one model, and the
// dependency rule judged on it.

import { DATE, controlsReplaced, isCalendarDate, readerLines, versionOf } from "../../_text.mjs";

// The declared structure, read into one model: docs/roadkeeper/dependency-rules.md, in the shape of its template in
// skills/slice/references/structure.md, and docs/roadkeeper/structure.json, the stack tool's output. Its fields:
// - `rings`, the declared levels, innermost first, peers on one ring; `ringOf`, each level's ring;
// - `declaredModules`, `exceptions`, `relations`, `tests` and `ignore`, as dependency-rules.md declares them;
// - `modules`, each with its `path`, `level` (its root files' outermost), `ring`, `levels` (its files' and its nested
//   modules', innermost first), `rootFiles`, `entry` (its one root file; none with several), `files` and `parent`;
// - `loose`, the files no module holds; `edges`, each with its two ends' modules and levels and whether an end is loose;
// - `declarations`; `levels`, the files' own tags; `fileLevels`, the level of every file the model knows; `mixed`, each
//   file of mixed levels with its levels, innermost first, counted everywhere else as its outermost;
// - `digest`; `malformed`, what cannot be read, never dropped.
// A file's level is its own tag, a root file's the level listed with it, else none: a private file, like a file no
// module holds, takes no level from an entry (ADR 0005). The Architecture tab and the structure checks read this one
// model. Both files are the repository's: every line shape is split by hand or by a regex anchored on fixed characters,
// so a long line costs its length, and every value is taken only if it is a string.

// the four kinds of edge a tool can see
export const EDGE_KINDS = ["dependency", "type-only", "implements", "inheritance"];
// the files read as code: JavaScript and TypeScript, as dependency-cruiser and the compiler parse them, Astro, Python
export const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx|astro|py)$/;
export const isAstro = (file) => file.endsWith(".astro");
export const isPython = (file) => file.endsWith(".py");
const RELATION_KINDS = ["association", "aggregation", "composition"];
// one case, so `Domain` and `domain` are never two levels; no space or `|`, which split a ring; a name, not a text, so
// at most 64 characters
export const LEVEL_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const NUMBERED = /^\s*\d+\./;
const SEPARATOR = /\s[—–-]\s/;
// the arrow between two quoted paths, as a line writes it: `→` or `->`
export const ARROW = String.raw`\s*(?:→|->)\s*`;
const EDGE_EXCEPTION_LINE = new RegExp(String.raw`^-\s+\x60([^\x60]+)\x60${ARROW}\x60([^\x60]+)\x60\s+[—–-]\s+(.+)$`);
// an exception naming one path, a file or a module's folder: its own rulings allowed until the review point
const PATH_EXCEPTION_LINE = /^-\s+\x60([^\x60]+)\x60\s+[—–-]\s+(.+)$/;
const RELATION_LINE = new RegExp(String.raw`^-\s+([a-z]+):\s+\x60([^\x60]+)\x60${ARROW}\x60([^\x60]+)\x60\s*$`);
// an exception's review point: a day, or the version by whose stamp it is resolved
const REVIEW_POINT = /\((\d{4}-\d{2}-\d{2}|v\d+(?:\.\d+){0,3})\)$/;
// a test pattern: a path with `*` (within a folder) and `**` (across folders), nothing else special; a few segments and
// a few stars, so matching it against a path has a small fixed cost
const TEST_PATTERN = /^[A-Za-z0-9_.*-]+(?:\/[A-Za-z0-9_.*-]+)*$/;
const TEST_SEGMENTS = 16, TEST_STARS = 8;
// a project ignores a few build outputs: past MAX_IGNORE a line is unread, so the walk's matching stays bounded
export const MAX_IGNORE = 20;
// a `## Modules` line, `- \`folder\`` or `- \`folder/*\``; a one-line comment, as the reference's template keeps under
// each heading, is no line
const MODULE_LINE = /^-\s+\x60([^\x60]{1,1024})\x60\s*$/;
const COMMENT_LINE = /^<!--.*-->$/;
// a project declares tens of modules; past this many a line is unread, so a list cannot stall the walk
const MAX_MODULES = 500;
// one path under another, by whole segments: `src/a/b` is under `src/a`, `src/ab` is not
export const underPath = (child, ancestor) => child === ancestor || child.startsWith(ancestor + "/");
// the SHA-256 the stamp wrote over the modules' files, so a check can tell a graph older than its code
const DIGEST = /^[0-9a-f]{64}$/;
// a path is the repository's own, as the tools print it from the root: no leading `/`, no `.`/`..` or empty segment,
// no colon (a drive or a scheme) and no space at either end
const NOT_RELATIVE = /^(?:\/|\.\.?(?:\/|$))|\/\.\.?(?:\/|$)|\/\/|:|^\s|\s$/;
// a module's owner is found by walking up a path's folders, so a path's cost is its depth times its length
export const MAX_DEPTH = 64;
// and its length is capped: V8 hashes a string past 16 383 characters by its length alone, so long paths collide in the
// owner lookup
export const MAX_PATH = 1024;
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

// a message quotes at most this much of the repository's text
const SHOWN = 200;
// a whole message, however many values it quotes
const MESSAGE = 600;
// levels are a handful of rings; past this many the line is unread, so a list of names cannot fill the page
const MAX_RINGS = 32;
// and a ring holds a few peers, so the levels a page carries stay bounded
const MAX_PEERS = 8;
// a value quoted in a message: its backticks become `'`, so every backtick pair in a message is the reader's own and
// the repository's text is exactly what they hold
const shown = (s) => { const t = String(s).replace(/`/g, "'"); return t.length > SHOWN ? t.slice(0, SHOWN) + "…" : t; };
// the cap a structure file is read under
export const STRUCTURE_CAP = 8 * 1024 * 1024;
// the line a check or a plan prints when a structure file is not read: it judges nothing past it
export const STRUCTURE_UNREAD = `unread    docs/roadkeeper/dependency-rules.md or structure.json is missing, a link, or over the ${STRUCTURE_CAP / 1024 / 1024} MB cap`;
// a path from a structure file read as the reader reads it, for the stamp that writes structure.json back
export const structurePath = (v) => pathOf(v);
function pathOf(v) {
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
export function structureModel(mdText, jsonText) {
  // a whole message is capped too: a line may quote several of the repository's values; a cut that leaves a quoted
  // value open closes it, so the repository's text is still inside a pair
  const cut = (what) => { if (what.length <= MESSAGE) return what; const t = what.slice(0, MESSAGE) + "…"; return (t.split("`").length - 1) % 2 ? t + "`" : t; };
  const malformed = [], bad = (where, what) => malformed.push({ where, what: cut(what) });
  const rings = [], ringOf = new Map(), exceptions = [], relations = [], tests = [], ignore = [], declaredModules = { folders: [], groups: [] };
  const ends = (at, a, b, push) => {
    const f = pathOf(a), t = pathOf(b);
    if (f.why || t.why) return bad(at, `a path ${f.why || t.why}`);
    push(f.path, t.path);
  };
  // an `## Exceptions` line, trimmed, at its line number: an edge's, or one path's for its own rulings
  const exceptionLine = (at, line, n) => {
    const m = EDGE_EXCEPTION_LINE.exec(line), pathLineMatch = m ? null : PATH_EXCEPTION_LINE.exec(line);
    // the why is each shape's last group
    const read = m || pathLineMatch, why = read ? read[read.length - 1].trim() : "", d = REVIEW_POINT.exec(why);
    const isDay = d && DATE.test(d[1]);
    if (!read || !d || (isDay && !isCalendarDate(d[1]))) return bad(at, "an exception line reads - `from` → `to` — why (YYYY-MM-DD or vX.Y.Z), or - `path` — why (…) for a file's or a module's own rulings; the day it is reviewed again or the version by whose stamp it is resolved");
    const x = { why: why.slice(0, d.index).trim(), until: d[1], untilKind: isDay ? "date" : "version", line: n };
    if (m) return ends(at, m[1], m[2], (from, to) => exceptions.push({ from, to, ...x }));
    const p = pathOf(pathLineMatch[1]);
    return p.why ? bad(at, `a path ${p.why}`) : exceptions.push({ path: p.path, from: null, to: null, ...x });
  };
  let section = null;
  readerLines(mdText).forEach((line, idx) => {
    const at = `dependency-rules.md:${idx + 1}`;
    if (/^##\s/.test(line)) { section = line.slice(2).trim().toLowerCase(); return; }
    if (!line.trim()) return;
    if (section === "levels" && NUMBERED.test(line)) {
      const rest = line.replace(NUMBERED, ""), cut = rest.search(SEPARATOR);
      const names = cut < 0 ? [] : rest.slice(0, cut).split("|").map((s) => s.trim());
      if (!names.length || names.some((n) => !LEVEL_NAME.test(n))) return bad(at, "a level line reads `N. name | peer — what it holds`, names in lowercase letters, digits and -, at most 64 characters");
      if (rings.length >= MAX_RINGS) return bad(at, `more than ${MAX_RINGS} rings: a ring this far out is not read`);
      if (names.length > MAX_PEERS) return bad(at, `more than ${MAX_PEERS} levels on one ring: the line is not read`);
      for (const n of names) if (ringOf.has(n)) bad(at, `level \`${shown(n)}\` declared twice`); else ringOf.set(n, rings.length);
      rings.push(names);
    } else if (section === "exceptions" && /^-\s/.test(line)) {
      exceptionLine(at, line.trim(), idx + 1);
    } else if ((section === "tests" || section === "ignore") && /^-\s/.test(line)) {
      // `## Ignore` names files the digest leaves out — a build's output inside a module — in the same shape as tests
      const m = /^-\s+\x60([^\x60]{1,200})\x60\s*$/.exec(line.trim());
      const segs = m ? m[1].split("/") : [];
      if (!m || !TEST_PATTERN.test(m[1]) || /(?:^|\/)\.\.?(?:\/|$)/.test(m[1]) || segs.length > TEST_SEGMENTS
        || segs.some((g) => g !== "**" && g.includes("**")) || (m[1].match(/\*/g) || []).length > TEST_STARS) {
        return bad(at, `${section === "tests" ? "a test" : "an ignore"} line reads - \`pattern\`, a path with * and ** (** a whole segment) and no . or .. segment, at most ${TEST_SEGMENTS} segments and ${TEST_STARS} stars`);
      }
      if (section === "ignore" && ignore.length >= MAX_IGNORE) return bad(at, `more than ${MAX_IGNORE} ignore patterns: the line is not read`);
      (section === "tests" ? tests : ignore).push(m[1]);
    } else if (section === "modules" && !COMMENT_LINE.test(line.trim())) {
      const m = MODULE_LINE.exec(line.trim()), group = m && m[1].endsWith("/*");
      const p = m ? pathOf(group ? m[1].slice(0, -2) : m[1]) : { why: "is not in that shape" };
      if (p.why) return bad(at, `a module line reads - \`folder\`, with /* after the folder for every folder directly under it; this one ${p.why}`);
      if (declaredModules.folders.length + declaredModules.groups.length >= MAX_MODULES) return bad(at, `more than ${MAX_MODULES} module lines: the line is not read`);
      (group ? declaredModules.groups : declaredModules.folders).push(p.path);
    } else if (section === "relations" && /^-\s/.test(line)) {
      const m = RELATION_LINE.exec(line.trim());
      if (!m || !RELATION_KINDS.includes(m[1])) return bad(at, `a relation line reads - ${RELATION_KINDS.join(" | ")}: \`from\` → \`to\``);
      ends(at, m[2], m[3], (from, to) => relations.push({ kind: m[1], from, to, line: idx + 1 }));
    }
  });
  if (!rings.length) bad("dependency-rules.md", "no levels declared under `## Levels`");
  const ringOfLevel = Object.assign(Object.create(null), Object.fromEntries(ringOf));
  const order = new Map(rings.flat().map((n, i) => [n, i]));
  // A tag's value: one level, or several split by spaces (a file of mixed levels), each declared: { list } innermost
  // first, each once, its last the outermost (of peers, the one declared later); or { why }.
  const levelList = (v) => {
    if (typeof v !== "string") return { why: "a value that is not a name is not a declared level" };
    const names = v.split(/\s+/).filter(Boolean), undeclared = names.find((n) => !ringOf.has(n));
    if (!names.length || undeclared !== undefined) return { why: `\`${shown(undeclared ?? v)}\` is not a declared level` };
    return { list: [...new Set(names)].sort((a, b) => order.get(a) - order.get(b)) };
  };
  // a level list's outermost level: its last
  const outermostOf = (list) => list[list.length - 1];
  // the files whose tag names several levels, each with its levels
  const mixedFiles = Object.create(null);
  let data = null;
  try { data = JSON.parse(String(jsonText || "").replace(/^\uFEFF/, "")); } catch { /* reported below */ }
  if (!data || typeof data !== "object" || !Array.isArray(data.modules) || !Array.isArray(data.edges)) {
    bad("structure.json", "structure.json is not an object with `modules` and `edges` arrays");
    return { rings, ringOf: ringOfLevel, declaredModules, modules: [], loose: [], edges: [], exceptions, relations, declarations: [], levels: [], fileLevels: Object.create(null), mixed: mixedFiles, tests, ignore, digest: null, malformed };
  }
  const modules = [], byPath = new Map(), rootFileLevelsOf = new Map();
  data.modules.forEach((mod, i) => {
    const at = `structure.json modules[${i}]`, { path, why } = pathOf(mod && mod.path);
    if (why) return bad(at, `a module's path ${why}`);
    if (byPath.has(path)) return bad(at, `module \`${shown(path)}\` listed twice`);
    // the files at the module's root, each once
    const rootFileLevels = [], listed = new Set();
    for (const e of Array.isArray(mod.entries) ? mod.entries : []) {
      const f = pathOf(e && e.file), level = e && typeof e.level === "string" ? e.level : null, read = levelList(level);
      if (f.why) { bad(at, `a root file ${f.why}`); continue; }
      if (listed.has(f.path)) continue;
      listed.add(f.path);
      // a tag naming several levels: the file's level is its outermost, its span all of them
      rootFileLevels.push({ file: f.path, level: read.list ? outermostOf(read.list) : level, levels: read.list || (level ? [level] : []) });
      if (read.list && read.list.length > 1) mixedFiles[f.path] = read.list;
      if (!level && rootFileLevels.length === 1) bad(at, `\`${shown(f.path)}\` has no @level`);
      else if (level && read.why) bad(at, `\`${shown(f.path)}\`: ${read.why}`);
    }
    if (!rootFileLevels.length) bad(at, `module \`${shown(path)}\` has no root file`);
    // seen from outside, a module has its entry's level; a private file names its own (ADR 0005). With several root files
    // none is the entry, and outside reaches each: the outermost of their levels, whichever is listed first
    const rootLevels = rootFileLevels.map((r) => r.level).filter((l) => ringOf.has(l));
    const level = rootLevels.length ? rootLevels.reduce((a, b) => (order.get(b) > order.get(a) ? b : a)) : null;
    // every file of the module, when the tool lists them: the page's openness gauge and drill-down read it
    let files = null;
    if (Array.isArray(mod.files)) {
      files = [];
      for (const v of mod.files) { const f = pathOf(v); if (f.why) bad(at, `a file ${f.why}`); else files.push(f.path); }
    }
    const mod2 = {
      path, level, ring: level !== null ? ringOf.get(level) : null, levels: [], rootFiles: rootFileLevels.map((r) => r.file), entry: rootFileLevels.length === 1 ? rootFileLevels[0].file : null, files, parent: null,
    };
    modules.push(mod2); byPath.set(path, mod2); rootFileLevelsOf.set(mod2, rootFileLevels);
  });
  // the deepest module whose path is a whole-segment prefix: `src/order/line/x.ts` is in `src/order/line`, not `src/order`
  const owner = (file, self) => {
    for (const p of pathAndParents(file)) { const m = byPath.get(p); if (m && m !== self) return m; }
    return null;
  };
  for (const m of modules) { const p = owner(m.path, m); m.parent = p ? p.path : null; }
  // a declared line's ends resolve to modules here, where every reader finds them: the page and the checks never walk paths
  for (const x of [...relations, ...exceptions]) if (!x.path) { x.fromModule = owner(x.from)?.path ?? null; x.toModule = owner(x.to)?.path ?? null; }
  // a file's level: its own tag in `levels` (a file at a module's root has the level listed with it), else none
  const entryLevel = new Map(), entryTag = new Map();
  for (const [, rootFileLevels] of rootFileLevelsOf) for (const e of rootFileLevels) if (ringOf.has(e.level) && !entryLevel.has(e.file)) { entryLevel.set(e.file, e.level); entryTag.set(e.file, e.levels.join(" ")); }
  const tagged = new Map(), levels = [], own = new Map([...rootFileLevelsOf].map(([m, rootFileLevels]) => [m, new Set(rootFileLevels.flatMap((e) => e.levels).filter((l) => ringOf.has(l)))]));
  // one file's tag in `levels` taken: null, or why it does not read. A file of mixed levels counts as its outermost in
  // every ruling; its span is all of them
  const tagFile = (file, value) => {
    const read = levelList(value);
    if (read.why) return `\`${shown(file)}\`: ${read.why}`;
    const m = owner(file), entry = entryTag.get(file), tag = read.list.join(" "), outermost = outermostOf(read.list);
    if (entry !== undefined && entry !== tag) return `\`${shown(file)}\`: its entry says \`${shown(entry)}\`, \`levels\` says \`${shown(tag)}\``;
    tagged.set(file, outermost); levels.push({ file, level: outermost });
    if (read.list.length > 1) mixedFiles[file] = read.list;
    if (m) read.list.forEach((l) => own.get(m).add(l));
    return null;
  };
  const lv = data.levels, levelByFile = Object.assign(Object.create(null), lv);
  if (lv !== undefined) {
    const at = "structure.json levels", keys = new Set();
    if (!lv || typeof lv !== "object" || Array.isArray(lv)) bad(at, "`levels` is not an object of file → level");
    else for (const key of Object.keys(levelByFile)) {
      const f = pathOf(key);
      if (f.why) { bad(at, `a file ${f.why}`); continue; }
      if (keys.has(f.path)) { bad(at, `\`${shown(f.path)}\`'s level listed twice`); continue; }
      keys.add(f.path);
      const why = tagFile(f.path, levelByFile[key]);
      if (why) bad(at, why);
    }
  }
  // the files no module holds: the ones listed, and every one tagged
  const looseSet = new Set(), listed = data.loose === undefined ? [] : data.loose;
  if (!Array.isArray(listed)) bad("structure.json loose", "`loose` is not a list of the files no module holds");
  else for (const v of listed) {
    const f = pathOf(v), m = f.why ? null : owner(f.path);
    if (f.why) bad("structure.json loose", `a file ${f.why}`);
    else if (m) bad("structure.json loose", `\`${shown(f.path)}\` is in module \`${shown(m.path)}\`: \`loose\` lists the files no module holds`);
    else looseSet.add(f.path);
  }
  for (const t of levels) if (!owner(t.file)) looseSet.add(t.file);
  const loose = [...looseSet].sort();
  const levelOf = (file) => tagged.get(file) || entryLevel.get(file) || null;
  // a module's levels are its own files' and its nested modules': children first, each folded into its parent
  for (const m of [...modules].sort((a, b) => b.path.split("/").length - a.path.split("/").length)) {
    const span = own.get(m);
    m.levels = [...span].sort((a, b) => order.get(a) - order.get(b));
    if (m.parent) for (const l of span) own.get(byPath.get(m.parent)).add(l);
  }
  // every file the model knows — a module's, listed, an entry, tagged, an edge's end, or one of `loose` — with its
  // resolved level
  const fileLevels = Object.create(null);
  const know = (file, m) => { const read = m || looseSet.has(file); if (read && !(file in fileLevels)) fileLevels[file] = levelOf(file); };
  for (const m of modules) { for (const f of m.rootFiles) know(f, m); for (const f of m.files || []) know(f, owner(f)); }
  for (const t of levels) know(t.file, owner(t.file));
  for (const f of loose) know(f, null);
  const edges = [];
  data.edges.forEach((e, i) => {
    const at = `structure.json edges[${i}]`, kind = e && e.kind;
    if (typeof kind !== "string" || !EDGE_KINDS.includes(kind)) return bad(at, `an edge's kind is not one of ${EDGE_KINDS.join(", ")} (association, aggregation and composition are declared in dependency-rules.md)`);
    ends(at, e.from, e.to, (from, to) => {
      const f = owner(from), t = owner(to);
      know(from, f); know(to, t);
      edges.push({
        from, to, kind, fromModule: f ? f.path : null, toModule: t ? t.path : null, fromLevel: levelOf(from), toLevel: levelOf(to),
        fromLoose: !f && looseSet.has(from), toLoose: !t && looseSet.has(to),
      });
    });
  });
  // what each file declares, when the tool lists it: the cards show a module's exported names as its interface
  const declarations = [], declared = new Set();
  const decl = data.declarations, declarationsByFile = Object.assign(Object.create(null), decl);
  if (decl !== undefined) {
    if (!decl || typeof decl !== "object" || Array.isArray(decl)) bad("structure.json declarations", "`declarations` is not an object of file → list");
    else for (const key of Object.keys(declarationsByFile)) {
      const at = `structure.json declarations`, f = pathOf(key), list = declarationsByFile[key];
      if (f.why) { bad(at, `a file ${f.why}`); continue; }
      // two keys that read as one file (`a.ts`, `a.ts/`) are one file listed twice
      if (declared.has(f.path)) { bad(at, `\`${shown(f.path)}\`'s declarations listed twice`); continue; }
      declared.add(f.path);
      if (!Array.isArray(list)) { bad(at, `\`${shown(f.path)}\`'s declarations are not a list`); continue; }
      const decls = [];
      for (const d of list) {
        const name = d && d.name, kind = d && d.kind, exported = d && d.exported;
        if (typeof name !== "string" || !name || name.length > SHOWN || !DECL_KINDS.includes(kind) || typeof exported !== "boolean") {
          bad(at, `a declaration in \`${shown(f.path)}\` reads { name, kind: ${DECL_KINDS.join(" | ")}, exported: true | false }, the name at most ${SHOWN} characters`);
          continue;
        }
        decls.push({ name, kind, exported });
      }
      declarations.push({ file: f.path, decls });
    }
  }
  let digest = null;
  if (data.digest !== undefined) {
    if (typeof data.digest === "string" && DIGEST.test(data.digest)) digest = data.digest;
    else bad("structure.json digest", "`digest` is the stamp's SHA-256 over the modules' files, 64 hex characters");
  }
  return { rings, ringOf: ringOfLevel, declaredModules, modules, loose, edges, exceptions, relations, declarations, levels, fileLevels, mixed: mixedFiles, tests, ignore, digest, malformed };
}
// an edge's two ends, the model's or the check's, one record each: its file, the module holding it (null for none) and
// whether it is one of the files no module holds
export const edgeEnds = (e) => [
  { file: e.from, module: e.fromModule, loose: e.fromLoose },
  { file: e.to, module: e.toModule, loose: e.toLoose },
];
// a file's level list: its mixed levels, innermost first, else its one level, else none
export const fileLevelList = (sm, f) => (sm.mixed && sm.mixed[f]) || (sm.fileLevels && sm.fileLevels[f] ? [sm.fileLevels[f]] : []);
// each part's levels: a part is a module, or a file no module holds, standing as a module of its own at its tag's
// levels. Map(path → levels)
export const partLevels = (sm) => new Map([...sm.modules.map((m) => [m.path, m.levels]), ...sm.loose.map((f) => [f, fileLevelList(sm, f)])]);
// an edge end's part: the module holding it, else its file when no module holds it; null outside the code read
const partOf = (end) => end.module || (end.loose ? end.file : null);
// a model's edges between two of its parts, one per pair; `modules` when both ends are modules. Map(`from\nto` → edge)
export function pairsOf(sm) {
  const pairs = new Map();
  for (const e of sm.edges) {
    const [a, b] = edgeEnds(e), from = partOf(a), to = partOf(b);
    const betweenTwo = from && to && from !== to;
    if (!betweenTwo) continue;
    const key = `${from}\n${to}`;
    if (!pairs.has(key)) pairs.set(key, { from, to, kind: e.kind, modules: Boolean(a.module && b.module) });
  }
  return pairs;
}
// whether structure.json says what code it read: a module, or a file no module holds
export const readsCode = (sm) => sm.modules.length > 0 || sm.loose.length > 0;
// a level placed on its ring, as `outward` compares two: no ring when the level is none or undeclared
export const placed = (sm, level) => ({ level, ring: level != null && level in sm.ringOf ? sm.ringOf[level] : null });
export const DECL_KINDS = ["fn", "class", "const", "type", "other"];

// outward: a dependency on an outer ring, or on another level of the same ring (levels sharing a ring never depend on
// each other); null when either level is undeclared
export function outward(from, to) {
  if (from.ring == null || to.ring == null) return null;
  return to.ring > from.ring || (to.ring === from.ring && to.level !== from.level);
}

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
// The review point (GLOSSARY: Review point): a day, `YYYY-MM-DD`, or a version, `vX.Y.Z`, as the reader took it. The
// check decides by these alone; the Architecture tab's page embeds reviewPointKind and reviewPointOrder by their source.
//
// reviewPointKind: 'day' or 'version', by the point's shape.
export function reviewPointKind(p) {
  return /^[vV]/.test(p) ? 'version' : 'day';
}
// reviewPointOrder: below 0 when `a` comes first, 0 when the two are one point, above 0 when `b` does; versions part
// by part (v0.9 before v0.10), days as written; null for a day against a version, which never sort together.
export function reviewPointOrder(a, b) {
  var kind = reviewPointKind(a);
  if (kind !== reviewPointKind(b)) return null;
  if (kind === 'day') { if (a === b) return 0; return a < b ? -1 : 1; }
  var x = a.slice(1).split('.'), y = b.slice(1).split('.');
  for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (Number(x[i]) || 0) - (Number(y[i]) || 0); if (d) return d; }
  return 0;
}
// reviewPointDue: a day is due on it or after, given today; a version once it or a later one is in `closed`, the
// versions closed on the tracker (or the one a stamp is about to write).
export function reviewPointDue(p, today, closed) {
  if (reviewPointKind(p) === 'day') return Boolean(today) && reviewPointOrder(p, today) <= 0;
  for (var i = 0; i < closed.length; i++) { var o = reviewPointOrder(closed[i], p); if (o !== null && o >= 0) return true; }
  return false;
}
// the versions a tracker snapshot shows closed: its closed milestones' titles that open on a version
export const closedVersions = (snap) => snap.milestones.filter((m) => m.state === "closed").map((m) => versionOf(m.title)).filter(Boolean);
