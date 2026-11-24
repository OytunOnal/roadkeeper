// @level domain
// Roadkeeper — docs/roadkeeper/dependency-rules.md read, in the shape of its template in
// skills/slice/references/structure.md: its levels, exceptions, relations, tests and tests mirrors, ignore patterns and
// declared modules, the first half of the declared structure (structure-model.mjs). Every line shape is split by hand
// or by a regex anchored on fixed characters, so a long line costs its length.

import { DATE, isCalendarDate, readerLines } from "../../_text.mjs";
import { endsRead, shown, structurePath } from "./structure-path.mjs";

// one case, so `Domain` and `domain` are never two levels; no space or `|`, which split a ring; a name, not a text, so
// at most 64 characters
export const LEVEL_NAME = /^[a-z][a-z0-9-]{0,63}$/;
// the arrow between two quoted paths, as a line writes it: `→` or `->`
export const ARROW = String.raw`\s*(?:→|->)\s*`;
// the kinds a `## Relations` line names, the ones the code cannot show
const RELATION_KINDS = ["association", "aggregation", "composition"];
const NUMBERED = /^\s*\d+\./; // a `## Levels` line's number
const SEPARATOR = /\s[—–-]\s/; // the dash between a level line's names and what they hold
// an exception on an edge: `- \`from\` → \`to\` — why (review point)`
const EDGE_EXCEPTION_LINE = new RegExp(String.raw`^-\s+\x60([^\x60]+)\x60${ARROW}\x60([^\x60]+)\x60\s+[—–-]\s+(.+)$`);
// an exception naming one path, a file or a module's folder: its own rulings allowed until the review point
const PATH_EXCEPTION_LINE = /^-\s+\x60([^\x60]+)\x60\s+[—–-]\s+(.+)$/;
// a relation: `- kind: \`from\` → \`to\``
const RELATION_LINE = new RegExp(String.raw`^-\s+([a-z]+):\s+\x60([^\x60]+)\x60${ARROW}\x60([^\x60]+)\x60\s*$`);
// an exception's review point: a day, or the version by whose stamp it is resolved
const REVIEW_POINT = /\((\d{4}-\d{2}-\d{2}|v\d+(?:\.\d+){0,3})\)$/;
// a test pattern: a path with `*` (within a folder) and `**` (across folders), nothing else special; a few segments and
// a few stars, so matching it against a path has a small fixed cost
const TEST_PATTERN = /^[A-Za-z0-9_.*-]+(?:\/[A-Za-z0-9_.*-]+)*$/;
const TEST_SEGMENTS = 16; // segments a test or ignore pattern may have
const TEST_STARS = 8; // stars a test or ignore pattern may have
// a tests mirror: `- \`tests/\` mirrors \`scripts/\``, a tests folder holding a code folder's suites at the same paths
const MIRROR_LINE = /^-\s+\x60([^\x60*]{1,200})\x60\s+mirrors\s+\x60([^\x60*]{1,200})\x60\s*$/;
// a project has a code folder or two; past this many a mirror line is unread, so the rulings' lookup stays small
const MAX_MIRRORS = 8;
// a project ignores a few build outputs: past MAX_IGNORE a line is unread, so the walk's matching stays bounded
export const MAX_IGNORE = 20;
// a `## Modules` line, `- \`folder\`` or `- \`folder/*\``; a one-line comment, as the reference's template keeps under
// each heading, is no line
const MODULE_LINE = /^-\s+\x60([^\x60]{1,1024})\x60\s*$/;
const COMMENT_LINE = /^<!--.*-->$/; // a one-line HTML comment
// a project declares tens of modules; past this many a line is unread, so a list cannot stall the walk
const MAX_MODULES = 500;
// levels are a handful of rings; past this many the line is unread, so a list of names cannot fill the page
const MAX_RINGS = 32;
// and a ring holds a few peers, so the levels a page carries stay bounded
const MAX_PEERS = 8;

// dependency-rules.md's text read: { rings, the declared levels, innermost first, peers on one ring; ringOf, each
// level's ring (a Map); exceptions; relations; tests; mirrors, each a tests folder and the code folder whose suites it
// holds; ignore; declaredModules, { folders, groups } }. A line that does not read goes to `bad(where, what)`.
export function dependencyRules(mdText, bad) {
  const reader = new DependencyRulesReader(bad);
  readerLines(mdText).forEach((line, index) => reader.readLine(line, index + 1));
  if (!reader.rings.length) bad("dependency-rules.md", "no levels declared under `## Levels`");
  const { rings, ringOf, exceptions, relations, tests, mirrors, ignore, declaredModules } = reader;
  return { rings, ringOf, exceptions, relations, tests, mirrors, ignore, declaredModules };
}

// whether a test or ignore pattern has its shape: a path with * and ** (** a whole segment) and no . or .. segment,
// within the caps
function isPatternShape(pattern) {
  const segments = pattern.split("/");
  return TEST_PATTERN.test(pattern) && !/(?:^|\/)\.\.?(?:\/|$)/.test(pattern) && segments.length <= TEST_SEGMENTS
    && !segments.some((segment) => segment !== "**" && segment.includes("**")) && (pattern.match(/\*/g) || []).length <= TEST_STARS;
}

// One pass over the file's lines: the section it is in, and what each section's lines declared so far.
class DependencyRulesReader {
  constructor(bad) {
    this.bad = bad;
    this.section = null;
    this.rings = [];
    this.ringOf = new Map();
    this.exceptions = [];
    this.relations = [];
    this.tests = [];
    this.mirrors = [];
    this.ignore = [];
    this.declaredModules = { folders: [], groups: [] };
  }

  // line `lineNumber`, read by the section it is in
  readLine(line, lineNumber) {
    const at = `dependency-rules.md:${lineNumber}`, section = this.section, isItem = /^-\s/.test(line);
    if (/^##\s/.test(line)) { this.section = line.slice(2).trim().toLowerCase(); return; }
    if (!line.trim()) return;
    const mirror = section === "tests" ? MIRROR_LINE.exec(line.trim()) : null;
    const isPatternLine = (section === "tests" || section === "ignore") && isItem;
    if (section === "levels" && NUMBERED.test(line)) this.levelLine(at, line);
    else if (section === "exceptions" && isItem) this.exceptionLine(at, line.trim(), lineNumber);
    else if (mirror) this.mirrorLine(at, mirror);
    else if (isPatternLine) this.patternLine(at, line.trim());
    else if (section === "modules" && !COMMENT_LINE.test(line.trim())) this.moduleLine(at, line.trim());
    else if (section === "relations" && isItem) this.relationLine(at, line.trim(), lineNumber);
  }

  // a `## Levels` line: `N. name | peer — what it holds`, one ring
  levelLine(at, line) {
    const rest = line.replace(NUMBERED, ""), cut = rest.search(SEPARATOR);
    const names = cut < 0 ? [] : rest.slice(0, cut).split("|").map((name) => name.trim());
    if (!names.length || names.some((name) => !LEVEL_NAME.test(name))) return this.bad(at, "a level line reads `N. name | peer — what it holds`, names in lowercase letters, digits and -, at most 64 characters");
    if (this.rings.length >= MAX_RINGS) return this.bad(at, `more than ${MAX_RINGS} rings: a ring this far out is not read`);
    if (names.length > MAX_PEERS) return this.bad(at, `more than ${MAX_PEERS} levels on one ring: the line is not read`);
    for (const name of names) if (this.ringOf.has(name)) this.bad(at, `level \`${shown(name)}\` declared twice`); else this.ringOf.set(name, this.rings.length);
    this.rings.push(names);
  }

  // an `## Exceptions` line, trimmed, at its line number: an edge's, or one path's for its own rulings
  exceptionLine(at, line, lineNumber) {
    const edgeMatch = EDGE_EXCEPTION_LINE.exec(line), pathLineMatch = edgeMatch ? null : PATH_EXCEPTION_LINE.exec(line);
    // the why is each shape's last group
    const read = edgeMatch || pathLineMatch, why = read ? read[read.length - 1].trim() : "", reviewPoint = REVIEW_POINT.exec(why);
    const isDay = reviewPoint && DATE.test(reviewPoint[1]);
    const readable = read && reviewPoint && (!isDay || isCalendarDate(reviewPoint[1]));
    if (!readable) return this.bad(at, "an exception line reads - `from` → `to` — why (YYYY-MM-DD or vX.Y.Z), or - `path` — why (…) for a file's or a module's own rulings; the day it is reviewed again or the version by whose stamp it is resolved");
    const allowance = { why: why.slice(0, reviewPoint.index).trim(), until: reviewPoint[1], untilKind: isDay ? "date" : "version", line: lineNumber };
    if (edgeMatch) {
      const ends = endsRead(edgeMatch[1], edgeMatch[2]);
      return ends.why ? this.bad(at, ends.why) : this.exceptions.push({ from: ends.from, to: ends.to, ...allowance });
    }
    const path = structurePath(pathLineMatch[1]);
    return path.why ? this.bad(at, `a path ${path.why}`) : this.exceptions.push({ path: path.path, from: null, to: null, ...allowance });
  }

  // a `## Tests` mirror line, matched: the tests folder and the code folder whose suites it holds at the same paths
  mirrorLine(at, match) {
    if (this.mirrors.length >= MAX_MIRRORS) return this.bad(at, `more than ${MAX_MIRRORS} mirror lines: the line is not read`);
    const ends = endsRead(match[1], match[2]);
    return ends.why ? this.bad(at, ends.why) : this.mirrors.push({ tests: ends.from, code: ends.to });
  }

  // a `## Tests` or `## Ignore` pattern line, trimmed; `## Ignore` names files the digest leaves out — a build's output
  // inside a module — in the same shape as tests
  patternLine(at, line) {
    const match = /^-\s+\x60([^\x60]{1,200})\x60\s*$/.exec(line), isTests = this.section === "tests";
    if (!match || !isPatternShape(match[1])) {
      return this.bad(at, `${isTests ? "a test" : "an ignore"} line reads - \`pattern\`, a path with * and ** (** a whole segment) and no . or .. segment, at most ${TEST_SEGMENTS} segments and ${TEST_STARS} stars${isTests ? ", or - `tests/` mirrors `scripts/` for a tests folder holding a code folder's suites at the same paths" : ""}`);
    }
    if (!isTests && this.ignore.length >= MAX_IGNORE) return this.bad(at, `more than ${MAX_IGNORE} ignore patterns: the line is not read`);
    return (isTests ? this.tests : this.ignore).push(match[1]);
  }

  // a `## Modules` line, trimmed: a module's folder, or with /* every folder directly under it
  moduleLine(at, line) {
    const match = MODULE_LINE.exec(line), group = match && match[1].endsWith("/*");
    const path = match ? structurePath(group ? match[1].slice(0, -2) : match[1]) : { why: "is not in that shape" };
    if (path.why) return this.bad(at, `a module line reads - \`folder\`, with /* after the folder for every folder directly under it; this one ${path.why}`);
    if (this.declaredModules.folders.length + this.declaredModules.groups.length >= MAX_MODULES) return this.bad(at, `more than ${MAX_MODULES} module lines: the line is not read`);
    return (group ? this.declaredModules.groups : this.declaredModules.folders).push(path.path);
  }

  // a `## Relations` line, trimmed, at its line number
  relationLine(at, line, lineNumber) {
    const match = RELATION_LINE.exec(line);
    if (!match || !RELATION_KINDS.includes(match[1])) return this.bad(at, `a relation line reads - ${RELATION_KINDS.join(" | ")}: \`from\` → \`to\``);
    const ends = endsRead(match[2], match[3]);
    return ends.why ? this.bad(at, ends.why) : this.relations.push({ kind: match[1], from: ends.from, to: ends.to, line: lineNumber });
  }
}
