// @level domain
// Roadkeeper — the declared structure: docs/roadkeeper/dependency-rules.md and structure.json read into one model, and the
// dependency rule judged on it.

import { pathAndParents } from "./path-match.mjs";
import { readPurity } from "./inner-levels-pure.mjs";
import { dependencyRules } from "./dependency-rules.mjs";
import { parseJsonText } from "./parse-json-text.mjs";
import { SHOWN, endsRead, shown, structurePath } from "./structure-path.mjs";

// The declared structure, read into one model: docs/roadkeeper/dependency-rules.md, in the shape of its template in
// skills/slice/references/structure.md (dependency-rules.mjs), and docs/roadkeeper/structure.json, the stack tool's
// output. Its fields:
// - `rings`, the declared levels, innermost first, peers on one ring; `ringOf`, each level's ring;
// - `declaredModules`, `exceptions`, `relations`, `tests` and `ignore`, as dependency-rules.md declares them; `mirrors`,
//   its tests mirrors, each a tests folder and the code folder whose suites it holds at the same paths;
// - `modules`, each with its `path`, `level` (its root files' outermost), `ring`, `levels` (its files' and its nested
//   modules', innermost first), `rootFiles`, `entry` (its one root file; none with several), `files` and `parent`;
// - `loose`, the files no module holds; `edges`, each with its two ends' modules and levels and whether an end is loose;
// - `declarations`; `levels`, the files' own tags; `fileLevels`, the level of every file the model knows; `mixed`, each
//   file of mixed levels with its levels, innermost first, counted everywhere else as its outermost;
// - `digest`; `impure` and `impureBaseline`, the inner-level Python files' breaches of purity and the files kept as
//   their baseline (inner-levels-pure.mjs); `malformed`, what cannot be read, never dropped.
// A file's level is its own tag, a root file's the level listed with it, else none: a private file, like a file no
// module holds, takes no level from an entry (ADR 0005). The Architecture tab and the structure checks read this one
// model. Both files are the repository's: every line shape is split by hand or by a regex anchored on fixed characters,
// so a long line costs its length, and every value is taken only if it is a string.

// the four kinds of edge a tool can see
export const EDGE_KINDS = ["dependency", "type-only", "implements", "inheritance"];
// the kinds of declaration a tool lists for a file
export const DECL_KINDS = ["fn", "class", "const", "type", "other"];
// the SHA-256 the stamp wrote over the modules' files, so a check can tell a graph older than its code
const DIGEST = /^[0-9a-f]{64}$/;
// a whole message, however many values it quotes
const MESSAGE = 600;
// the cap a structure file is read under
export const STRUCTURE_CAP = 8 * 1024 * 1024;

// a whole message is capped too: a line may quote several of the repository's values; a cut that leaves a quoted value
// open closes it, so the repository's text is still inside a pair
const cutMessage = (what) => { if (what.length <= MESSAGE) return what; const t = what.slice(0, MESSAGE) + "…"; return (t.split("`").length - 1) % 2 ? t + "`" : t; };
// a level list's outermost level: its last
const outermostOf = (list) => list[list.length - 1];

export function structureModel(mdText, jsonText) {
  const malformed = [], bad = (where, what) => malformed.push({ where, what: cutMessage(what) });
  const rules = dependencyRules(mdText, bad);
  const { rings, exceptions, relations, tests, mirrors, ignore, declaredModules } = rules;
  const ringOfLevel = Object.assign(Object.create(null), Object.fromEntries(rules.ringOf));
  const data = parseGraph(jsonText);
  if (!data) {
    bad("structure.json", "structure.json is not an object with `modules` and `edges` arrays");
    return { rings, ringOf: ringOfLevel, declaredModules, modules: [], loose: [], edges: [], exceptions, relations, declarations: [], levels: [], fileLevels: Object.create(null), mixed: Object.create(null), tests, mirrors, ignore, digest: null, impure: [], impureBaseline: [], malformed };
  }
  const graph = new GraphReader(rules, bad);
  data.modules.forEach((mod, i) => graph.readModule(mod, i));
  graph.linkParents();
  const ownedRelations = graph.withOwners(relations), ownedExceptions = graph.withOwners(exceptions);
  graph.readLevels(data.levels);
  const loose = graph.readLoose(data.loose);
  graph.foldModuleLevels();
  graph.knowFiles(loose);
  const edges = graph.readEdges(data.edges);
  const declarations = readDeclarations(data.declarations, bad);
  const digest = readDigest(data.digest, bad);
  const { modules, levels, fileLevels, mixedFiles } = graph;
  return { rings, ringOf: ringOfLevel, declaredModules, modules, loose, edges, exceptions: ownedExceptions, relations: ownedRelations, declarations, levels, fileLevels, mixed: mixedFiles, tests, mirrors, ignore, digest, ...readPurity(data, bad, structurePath), malformed };
}

// structure.json's text parsed, or null when it is not an object with `modules` and `edges` arrays
function parseGraph(jsonText) {
  const data = parseJsonText(jsonText);
  const isGraph = data && typeof data === "object" && Array.isArray(data.modules) && Array.isArray(data.edges);
  return isGraph ? data : null;
}

// One pass over structure.json's modules, levels, loose files and edges against the declared levels: what each step
// read so far, each module's root files with their levels, the files of mixed levels, and every file's level known.
class GraphReader {
  constructor({ rings, ringOf }, bad) {
    this.ringOf = ringOf;
    this.bad = bad;
    this.order = new Map(rings.flat().map((n, i) => [n, i]));
    this.modules = [];
    this.byPath = new Map();
    this.rootFileLevelsOf = new Map();
    // the files whose tag names several levels, each with its levels
    this.mixedFiles = Object.create(null);
    this.entryLevel = new Map();
    this.entryTag = new Map();
    this.own = new Map();
    this.tagged = new Map();
    this.levels = [];
    this.looseSet = new Set();
    this.fileLevels = Object.create(null);
  }

  // A tag's value: one level, or several split by spaces (a file of mixed levels), each declared: { list } innermost
  // first, each once, its last the outermost (of peers, the one declared later); or { why }.
  levelList(v) {
    if (typeof v !== "string") return { why: "a value that is not a name is not a declared level" };
    const names = v.split(/\s+/).filter(Boolean), undeclared = names.find((n) => !this.ringOf.has(n));
    if (!names.length || undeclared !== undefined) return { why: `\`${shown(undeclared ?? v)}\` is not a declared level` };
    return { list: [...new Set(names)].sort((a, b) => this.order.get(a) - this.order.get(b)) };
  }

  // the module at `modules[i]`, read with its root files and its files
  readModule(mod, i) {
    const at = `structure.json modules[${i}]`, { path, why } = structurePath(mod && mod.path);
    if (why) return this.bad(at, `a module's path ${why}`);
    if (this.byPath.has(path)) return this.bad(at, `module \`${shown(path)}\` listed twice`);
    const rootFileLevels = this.readRootFiles(mod, at);
    if (!rootFileLevels.length) this.bad(at, `module \`${shown(path)}\` has no root file`);
    // seen from outside, a module has its entry's level; a private file names its own (ADR 0005). With several root files
    // none is the entry, and outside reaches each: the outermost of their levels, whichever is listed first
    const rootLevels = rootFileLevels.map((r) => r.level).filter((l) => this.ringOf.has(l));
    const level = rootLevels.length ? rootLevels.reduce((a, b) => (this.order.get(b) > this.order.get(a) ? b : a)) : null;
    const files = this.readFileList(mod, at);
    const module = {
      path, level, ring: level !== null ? this.ringOf.get(level) : null, levels: [], rootFiles: rootFileLevels.map((r) => r.file), entry: rootFileLevels.length === 1 ? rootFileLevels[0].file : null, files, parent: null,
    };
    this.modules.push(module); this.byPath.set(path, module); this.rootFileLevelsOf.set(module, rootFileLevels);
    return null;
  }

  // the files at a module's root, each once, with its level and its span: a tag naming several levels makes the file's
  // level its outermost, its span all of them
  readRootFiles(mod, at) {
    const rootFileLevels = [], listed = new Set();
    for (const e of Array.isArray(mod.entries) ? mod.entries : []) {
      const f = structurePath(e && e.file), level = e && typeof e.level === "string" ? e.level : null, read = this.levelList(level);
      if (f.why) { this.bad(at, `a root file ${f.why}`); continue; }
      if (listed.has(f.path)) continue;
      listed.add(f.path);
      rootFileLevels.push({ file: f.path, level: read.list ? outermostOf(read.list) : level, levels: read.list || (level ? [level] : []) });
      if (read.list && read.list.length > 1) this.mixedFiles[f.path] = read.list;
      if (!level && rootFileLevels.length === 1) this.bad(at, `\`${shown(f.path)}\` has no @level`);
      else if (level && read.why) this.bad(at, `\`${shown(f.path)}\`: ${read.why}`);
    }
    return rootFileLevels;
  }

  // every file of the module, when the tool lists them: the page's openness gauge and drill-down read it; null when not
  readFileList(mod, at) {
    if (!Array.isArray(mod.files)) return null;
    const files = [];
    for (const v of mod.files) { const f = structurePath(v); if (f.why) this.bad(at, `a file ${f.why}`); else files.push(f.path); }
    return files;
  }

  // the deepest module whose path is a whole-segment prefix: `src/order/line/x.ts` is in `src/order/line`, not `src/order`
  owner(file, self) {
    for (const p of pathAndParents(file)) { const m = this.byPath.get(p); if (m && m !== self) return m; }
    return null;
  }

  // each module's parent, resolved here, where every reader finds it: the page and the checks never walk paths
  linkParents() {
    for (const m of this.modules) { const p = this.owner(m.path, m); m.parent = p ? p.path : null; }
  }

  // declared lines with their ends resolved to modules, as new lines; a line naming one path is kept as it is
  withOwners(declaredLines) {
    return declaredLines.map((line) => (line.path ? line
      : { ...line, fromModule: this.owner(line.from)?.path ?? null, toModule: this.owner(line.to)?.path ?? null }));
  }

  // structure.json's `levels`, each file's own tag: a file's level is its tag (a file at a module's root has the level
  // listed with it), else none
  readLevels(lv) {
    for (const [, rootFileLevels] of this.rootFileLevelsOf) for (const e of rootFileLevels) this.noteRootFile(e);
    this.own = new Map([...this.rootFileLevelsOf].map(([m, rootFileLevels]) => [m, new Set(rootFileLevels.flatMap((e) => e.levels).filter((l) => this.ringOf.has(l)))]));
    if (lv === undefined) return;
    const at = "structure.json levels", keys = new Set();
    const isFileMap = lv && typeof lv === "object" && !Array.isArray(lv);
    if (!isFileMap) { this.bad(at, "`levels` is not an object of file → level"); return; }
    const levelByFile = Object.assign(Object.create(null), lv);
    for (const key of Object.keys(levelByFile)) {
      const f = structurePath(key);
      if (f.why) { this.bad(at, `a file ${f.why}`); continue; }
      if (keys.has(f.path)) { this.bad(at, `\`${shown(f.path)}\`'s level listed twice`); continue; }
      keys.add(f.path);
      const why = this.tagFile(f.path, levelByFile[key]);
      if (why) this.bad(at, why);
    }
  }

  // a root file's level and tag, the first module listing it with a declared level
  noteRootFile(e) {
    if (!this.ringOf.has(e.level) || this.entryLevel.has(e.file)) return;
    this.entryLevel.set(e.file, e.level);
    this.entryTag.set(e.file, e.levels.join(" "));
  }

  // one file's tag in `levels` taken: null, or why it does not read. A file of mixed levels counts as its outermost in
  // every ruling; its span is all of them
  tagFile(file, value) {
    const read = this.levelList(value);
    if (read.why) return `\`${shown(file)}\`: ${read.why}`;
    const m = this.owner(file), entry = this.entryTag.get(file), tag = read.list.join(" "), outermost = outermostOf(read.list);
    if (entry !== undefined && entry !== tag) return `\`${shown(file)}\`: its entry says \`${shown(entry)}\`, \`levels\` says \`${shown(tag)}\``;
    this.tagged.set(file, outermost); this.levels.push({ file, level: outermost });
    if (read.list.length > 1) this.mixedFiles[file] = read.list;
    if (m) read.list.forEach((l) => this.own.get(m).add(l));
    return null;
  }

  // the files no module holds: the ones `loose` lists, and every one tagged; sorted
  readLoose(looseValue) {
    const listed = looseValue === undefined ? [] : looseValue;
    if (!Array.isArray(listed)) this.bad("structure.json loose", "`loose` is not a list of the files no module holds");
    else for (const v of listed) {
      const f = structurePath(v), m = f.why ? null : this.owner(f.path);
      if (f.why) this.bad("structure.json loose", `a file ${f.why}`);
      else if (m) this.bad("structure.json loose", `\`${shown(f.path)}\` is in module \`${shown(m.path)}\`: \`loose\` lists the files no module holds`);
      else this.looseSet.add(f.path);
    }
    for (const t of this.levels) if (!this.owner(t.file)) this.looseSet.add(t.file);
    return [...this.looseSet].sort();
  }

  levelOf(file) {
    return this.tagged.get(file) || this.entryLevel.get(file) || null;
  }

  // a module's levels are its own files' and its nested modules': children first, each folded into its parent
  foldModuleLevels() {
    for (const m of [...this.modules].sort((a, b) => b.path.split("/").length - a.path.split("/").length)) {
      const span = this.own.get(m);
      m.levels = [...span].sort((a, b) => this.order.get(a) - this.order.get(b));
      if (m.parent) for (const l of span) this.own.get(this.byPath.get(m.parent)).add(l);
    }
  }

  // a file the model knows — a module's, listed, an entry, tagged, an edge's end, or one of `loose` — with its resolved
  // level, the first time it is met
  know(file, m) {
    const read = m || this.looseSet.has(file);
    if (read && !(file in this.fileLevels)) this.fileLevels[file] = this.levelOf(file);
  }

  // every module's files, every tagged file and every loose one known
  knowFiles(loose) {
    for (const m of this.modules) { for (const f of m.rootFiles) this.know(f, m); for (const f of m.files || []) this.know(f, this.owner(f)); }
    for (const t of this.levels) this.know(t.file, this.owner(t.file));
    for (const f of loose) this.know(f, null);
  }

  // structure.json's edges, each with its two ends' modules and levels and whether an end is loose; its ends known
  readEdges(list) {
    const edges = [];
    list.forEach((e, i) => {
      const at = `structure.json edges[${i}]`, kind = e && e.kind;
      if (typeof kind !== "string" || !EDGE_KINDS.includes(kind)) return this.bad(at, `an edge's kind is not one of ${EDGE_KINDS.join(", ")} (association, aggregation and composition are declared in dependency-rules.md)`);
      const read = endsRead(e.from, e.to);
      if (read.why) return this.bad(at, read.why);
      const { from, to } = read, f = this.owner(from), t = this.owner(to);
      this.know(from, f); this.know(to, t);
      return edges.push({
        from, to, kind, fromModule: f ? f.path : null, toModule: t ? t.path : null, fromLevel: this.levelOf(from), toLevel: this.levelOf(to),
        fromLoose: !f && this.looseSet.has(from), toLoose: !t && this.looseSet.has(to),
      });
    });
    return edges;
  }
}

// What each file declares, when the tool lists it: the cards show a module's exported names as its interface. [{ file,
// decls }]; what does not read goes to `bad`.
function readDeclarations(decl, bad) {
  const declarations = [], declared = new Set(), at = "structure.json declarations";
  if (decl === undefined) return declarations;
  const isFileMap = decl && typeof decl === "object" && !Array.isArray(decl);
  if (!isFileMap) { bad(at, "`declarations` is not an object of file → list"); return declarations; }
  const declarationsByFile = Object.assign(Object.create(null), decl);
  for (const key of Object.keys(declarationsByFile)) {
    const f = structurePath(key), list = declarationsByFile[key];
    if (f.why) { bad(at, `a file ${f.why}`); continue; }
    // two keys that read as one file (`a.ts`, `a.ts/`) are one file listed twice
    if (declared.has(f.path)) { bad(at, `\`${shown(f.path)}\`'s declarations listed twice`); continue; }
    declared.add(f.path);
    if (!Array.isArray(list)) { bad(at, `\`${shown(f.path)}\`'s declarations are not a list`); continue; }
    declarations.push({ file: f.path, decls: readDecls(list, f.path, bad) });
  }
  return declarations;
}

// one file's declarations, each { name, kind, exported }; one that does not read goes to `bad`
function readDecls(list, file, bad) {
  const decls = [];
  for (const d of list) {
    const name = d && d.name, kind = d && d.kind, exported = d && d.exported;
    const isDeclaration = typeof name === "string" && name && name.length <= SHOWN && DECL_KINDS.includes(kind) && typeof exported === "boolean";
    if (isDeclaration) decls.push({ name, kind, exported });
    else bad("structure.json declarations", `a declaration in \`${shown(file)}\` reads { name, kind: ${DECL_KINDS.join(" | ")}, exported: true | false }, the name at most ${SHOWN} characters`);
  }
  return decls;
}

// the stamp's digest, or null when structure.json has none; one that does not read goes to `bad`
function readDigest(digest, bad) {
  if (digest === undefined) return null;
  if (typeof digest === "string" && DIGEST.test(digest)) return digest;
  bad("structure.json digest", "`digest` is the stamp's SHA-256 over the modules' files, 64 hex characters");
  return null;
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

// outward: a dependency on an outer ring, or on another level of the same ring (levels sharing a ring never depend on
// each other); null when either level is undeclared
export function outward(from, to) {
  if (from.ring == null || to.ring == null) return null;
  return to.ring > from.ring || (to.ring === from.ring && to.level !== from.level);
}
