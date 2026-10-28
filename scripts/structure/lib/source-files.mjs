// @level infrastructure
// Roadkeeper — the graph's sources from disk: dependency-rules.md through the one guarded read (disk-reads.mjs); every
// JavaScript, TypeScript, Astro and Python file the walk meets from the root and under each declared module's folder,
// but what `## Ignore` names; and each one's tag, `// @level` (`# @level` in Python), in its first comment after a
// shebang, a Python file's after an encoding line too, an Astro file's opening its frontmatter, blank lines passed over,
// one level or several. A declared folder that is missing or a link, a line of
// dependency-rules.md that does not read, a walk past a bound, and a structure.json that is a link stop it; it writes
// nothing.

import { closeSync, openSync, readSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { insideRoot, isPlainDir } from "../../_files.mjs";
import { readerLines } from "../../_text.mjs";
import { SOURCE, globMatch, isAstro, isPython, printable, readerMessage, structureModel } from "./structure-model.mjs";
import { SHOWN } from "./dependency-graph.mjs";
import { GRAPH, SKIP, readStructureFiles, walkFiles } from "./disk-reads.mjs";

// the first comment sits at a file's top: a shebang and a tag fit in this many bytes
const HEAD = 4096;
// a tag, `// @level <level>`, or several levels split by spaces for a file of mixed levels
const LEVEL_TAG = /^\/\/\s*@level\s+(\S+(?:\s+\S+)*)$/;
// a Python file's tag, the same after `#`
const PYTHON_LEVEL_TAG = /^#\s*@level\s+(\S+(?:\s+\S+)*)$/;
// a Python file's encoding line, as PEP 263 reads it
const ENCODING_LINE = /^[ \t\f]*#.*?coding[:=]/;

// the declared modules' folders, sorted, none when `## Modules` names none: each single folder, and every plain folder
// directly under a group's; or { stop } naming a declared folder that is missing or a link
function moduleFolders(root, { folders, groups }) {
  const out = new Set();
  const bad = [...folders, ...groups].find((p) => !isPlainDir(root, join(root, p)));
  if (bad !== undefined) return { stop: `the declared module ${printable(bad)} has no plain folder on disk` };
  for (const p of folders) out.add(p);
  for (const g of groups) {
    for (const n of readdirSync(join(root, g)).sort()) if (!SKIP(n) && isPlainDir(root, join(root, g, n))) out.add(`${g}/${n}`);
  }
  return { folders: [...out].sort() };
}

// every source file the walk meets from the root and under the folders, what `## Ignore` names left out: { files }, or
// { stop } past the walk's bounds
function walkedSources(root, folders, ignore) {
  // "" is the project root; a module's folder is walked from its own path, as the digest walks it
  const walked = walkFiles(root, ["", ...folders]);
  if (walked.over) return { stop: walked.over };
  const files = walked.files.map((f) => f.rel).filter((rel) => SOURCE.test(rel) && !ignore.some((p) => globMatch(p, rel)));
  return { files: [...new Set(files)].sort() };
}

// the level or levels a file's first comment names, `// @level <level> …`, after a byte-order mark and a shebang, one
// space between two; null for none
function levelOf(root, rel) {
  const buf = Buffer.alloc(HEAD), fd = openSync(join(root, rel), "r");
  let n;
  try { n = readSync(fd, buf, 0, HEAD, 0); } finally { closeSync(fd); }
  const first = taggable(rel, readerLines(buf.subarray(0, n).toString("utf8"))).find((l) => l.trim());
  const m = first ? (isPython(rel) ? PYTHON_LEVEL_TAG : LEVEL_TAG).exec(first.trim()) : null;
  return m ? m[1].split(/\s+/).join(" ") : null;
}

// the lines a file's tag may open: after a shebang; in a Python file, after an encoding line too, the first line that
// is not blank once the shebang is passed over; in an Astro file, after its frontmatter's opening `---`, the first line
// that is not blank, passed over as a shebang is, and none when that line is no `---`
function taggable(rel, lines) {
  const code = lines.slice(lines[0].startsWith("#!") ? 1 : 0);
  if (isPython(rel)) {
    const encoding = code.findIndex((l) => l.trim());
    return encoding >= 0 && ENCODING_LINE.test(code[encoding]) ? code.slice(encoding + 1) : code;
  }
  if (!isAstro(rel)) return code;
  const opening = lines.findIndex((l) => l.trim());
  return opening >= 0 && lines[opening].trim() === "---" ? lines.slice(opening + 1) : [];
}

// The structure command's sources at `root`: { root, md, folders, files, levels, tests, ignore }, `levels` each tagged
// file's; or { stop } naming why none was read. structure.json is not read for its text: the command writes it.
export function sourceFiles(root) {
  const read = readStructureFiles(root);
  if (read.why) return { stop: read.why };
  if (!insideRoot(root, join(root, GRAPH))) return { stop: "docs/roadkeeper/structure.json is a link" };
  const md = read.md;
  if (md === null) return { stop: "docs/roadkeeper/dependency-rules.md is missing, a link or over the cap" };
  const { declaredModules, ignore, tests, malformed } = structureModel(md, null);
  const unread = malformed.filter((m) => m.where.startsWith("dependency-rules.md:"));
  if (unread.length) return { stop: `${unread.length} line(s) of dependency-rules.md do not read: ${unread.slice(0, SHOWN).map((m) => `${m.where}: ${readerMessage(m.what)}`).join("; ")}` };
  const declared = moduleFolders(root, declaredModules);
  if (declared.stop) return declared;
  const walked = walkedSources(root, declared.folders, ignore);
  if (walked.stop) return walked;
  const levels = Object.create(null);
  for (const f of walked.files) { const l = levelOf(root, f); if (l) levels[f] = l; }
  return { root, md, folders: declared.folders, files: walked.files, levels, tests, ignore };
}
