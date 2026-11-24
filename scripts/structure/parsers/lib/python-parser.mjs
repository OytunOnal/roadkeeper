// @level infrastructure
// Roadkeeper — the Python part of the Parsers port (../parsers.mjs): python-reader.py, run once per read by the Python 3 on
// the PATH, parses the `.py` files given with Python's own `ast` and gives back each one's imports, top-level
// declarations, `__all__`, class bases, clock calls and calls to the built-in `open`; this file resolves them by the port's rules. The interpreter is `python3`, then `python`, each from the PATH's absolute folders, the
// first that runs the reader and reports Python 3; it runs isolated (`-I`), so no variable points the reader at the
// project's code. The reader's output is outside data: read under OUTPUT_MAX and checked against its shape, a
// malformed or oversized one a stop naming the reader. The read is bounded at READ_TIMEOUT and READ_PER_FILE a file
// given; one that runs out stops saying its bound. A file that does not parse stops in fixed words, its file, line
// and Python's version: Python's message, which can quote the file's own text, is never read. Writes nothing.
//
// Resolution: a relative import from the file's own folder, one dot per folder up; an absolute one in the importing
// file's folder, then each folder the file's `sys.path` calls add, then each folder above it, nearest first, as a suite
// putting its parent folder on `sys.path` finds a shared helper, then the root, then `src/` where it is a folder, at the
// first of them where its whole dotted name resolves, a partial match passing on to the next; `a.b` is `a/b/__init__.py` or `a/b.py`, or a folder with no
// `__init__.py`, a namespace package; `from a import b` names `b`'s file when it is a submodule, `a`'s otherwise. A
// namespace package imported whole: no edge, and not unresolved. Resolved nowhere: unresolved and the repository's own
// when its first part is at the root or in `src/`, else not the repository's own; a relative one not found: unresolved
// and the repository's own. A folder the file adds by `sys.path.insert(<i>, X)` or `sys.path.append(X)` is searched
// when X is the root joined with literal parts by `os.path.join`, `Path`, `/` or `.joinpath`, the root a chain of
// `os.path.dirname`, `.parent` or `.parents[k]` up from `__file__`, or a name imported from a file that sets it so; the
// last insert first, the appends after. Any other folder added to `sys.path` at run time, one from a variable or
// computed another way, is not seen.

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { findProgram } from "../../../_git.mjs";
import { callStopped, limitFor } from "../../../_time-limit.mjs";
import { printable } from "../../lib/printable.mjs";
import { nestingStop } from "./source-bounds.mjs";

// the reader, beside this file
const READER = fileURLToPath(new URL("./python-reader.py", import.meta.url));
// the names a Python 3 is looked for under, in order
const INTERPRETERS = ["python3", "python"];
// milliseconds the version's ask may take: a Store stub that opens a window is passed over
const ASK_TIMEOUT = 10000;
// milliseconds the read may take before its allowance: a few thousand files parse in seconds
const READ_TIMEOUT = 300000;
// milliseconds each .py file adds to the read's bound: three times the read measured over 3,000 files, 0.9 ms a file
const READ_PER_FILE = 2.7;
// the reader's output read at most: 50,000 files of a few imports each fit
const OUTPUT_MAX = 64 * 1024 * 1024;
// a version the reader reports, major.minor.micro of a Python 3
const PYTHON_3 = /^3\.\d+\.\d+$/;
// the stop when no interpreter runs Python 3
const NO_PYTHON = { stop: "Python 3 not found on the PATH, and the project holds .py files" };

const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

// the reader run by `program` on `args`, `input` on its stdin, Python isolated (`-I`): no `PYTHON*` variable, user
// site-packages or script folder on its path; its stdout; throws when it fails, overruns or runs long
const runReader = (program, args, { input, timeout }) => execFileSync(program, ["-I", READER, ...args], {
  input, encoding: "utf8", timeout, maxBuffer: OUTPUT_MAX, windowsHide: true, stdio: ["pipe", "pipe", "ignore"],
});

// a version's major and minor, `3.14` of `3.14.9`
const toMajorMinor = (version) => version.split(".").slice(0, 2).join(".");

// the first interpreter on the PATH that runs the reader and reports Python 3: { program, version }, its major and
// minor version; or null
function findPython3() {
  for (const name of INTERPRETERS) {
    const program = findProgram(name);
    if (!program) continue;
    let reported = "";
    try { reported = runReader(program, ["--version"], { input: "", timeout: ASK_TIMEOUT }).trim(); } catch { continue; }
    if (PYTHON_3.test(reported)) return { program, version: toMajorMinor(reported) };
  }
  return null;
}

// The Python read's bound for `count` .py files: READ_TIMEOUT and READ_PER_FILE a file.
export const pythonReadLimit = (count) => limitFor({ floor: READ_TIMEOUT, perFile: READ_PER_FILE }, count);

// the stop for a read that failed, `e` what threw, `bound` the read's: in fixed words and numbers only, never the
// reader's own text
function stopOnFailedRead(e, version, bound) {
  if (e && e.code === "ENOBUFS") return { stop: `the Python reader's output is over ${OUTPUT_MAX / 1024 / 1024} MB` };
  if (e && e.code === "ETIMEDOUT") return { stop: callStopped("the Python reader", bound, e) };
  const exit = e && Number.isInteger(e.status) ? e.status : "none";
  return { stop: `the Python reader failed (exit ${exit}) under Python ${version}` };
}

// What the Python 3 on the PATH reads of the `.py` files given: { read, heritage, declarations, tool, foundNowhere,
// outsideUses }, as the port gives them, the declarations `declared`'s, `tool` naming Python by its major and minor
// version, `foundNowhere` the imports found in no search place and not in the standard library, { file, name }; or
// { stop }.
export function pythonParser(root, { files, declared }) {
  const python = findPython3();
  if (!python) return NO_PYTHON;
  let output;
  const bound = pythonReadLimit(files.length);
  try { output = runReader(python.program, [], { input: JSON.stringify({ root, files }), timeout: bound }); } catch (e) {
    return stopOnFailedRead(e, python.version, bound);
  }
  const parsedOutput = parseReaderOutput(output, files);
  if (!parsedOutput) return { stop: "the Python reader's output does not read" };
  if (parsedOutput.stop) return stopOnUnreadFile(parsedOutput.stop, parsedOutput.version);
  const added = listAddedFolders(root, parsedOutput.files);
  const read = parsedOutput.files.map(({ file, imports }) => ({ file, imports: imports.flatMap((i) => resolveImport(root, file, copyWithAddedFolders(i, file, added))) }));
  const wanted = new Set(declared), declarations = Object.create(null);
  for (const row of parsedOutput.files) if (wanted.has(row.file)) declarations[row.file] = markExported(row);
  const given = new Set(files);
  const heritage = parsedOutput.files.flatMap(({ file, bases }) => [...new Set(bases.map((b) => findBaseFile(root, file, copyWithAddedFolders(b, file, added))))]
    .filter((to) => to !== null && to !== file && given.has(to)).map((to) => ({ from: file, to, kind: "inheritance" })));
  const outside = listOutsideImports(root, parsedOutput.files, added);
  const foundNowhere = outside.filter((i) => !i.stdlib).map(({ file, name }) => ({ file, name }));
  const callsOf = (field, kind) => parsedOutput.files.flatMap((row) => row[field].map(({ name, line }) => ({ file: row.file, line, name, kind, stdlib: true, typeOnly: false })));
  const calls = [...callsOf("clockCalls", "clock"), ...callsOf("ioCalls", "io")];
  return { read, heritage, declarations, tool: `Python ${toMajorMinor(parsedOutput.version)}`, foundNowhere, outsideUses: [...outside, ...calls] };
}

// The absolute imports in `rows` found in no search place, their first part at neither the root nor `src/`: the
// standard library's and the packages', each { file, line, name, kind: "import", stdlib, typeOnly }, the importing
// file and the dotted name.
function listOutsideImports(root, rows, added) {
  const isOutside = (file, i) => i.level === 0 && findStartFolder(root, file, copyWithAddedFolders(i, file, added)) === null
    && !isFirstPartAtRoot(root, i.module);
  return rows.flatMap(({ file, imports }) => imports.filter((i) => isOutside(file, i))
    .map((i) => ({ file, line: i.line, name: i.module, kind: "import", stdlib: i.stdlib, typeOnly: i.typeOnly })));
}

// A copy of the import or base `item` of the file `file`, with the folders its file puts on sys.path (`added`,
// listAddedFolders') as its `added`.
function copyWithAddedFolders(item, file, added) {
  return { ...item, added: added.get(file) };
}

// a folder joined from literal parts, root-relative, "" the root: null when a part is absolute or names a drive, or the
// folder leaves the root
function joinLiteralParts(parts) {
  const unsafe = parts.some((p) => p.startsWith("/") || p.includes("\\") || p.includes(":"));
  const folder = posix.join(".", ...parts.filter((p) => p !== ""));
  const leavesRoot = folder === ".." || folder.startsWith("../");
  if (unsafe || leavesRoot) return null;
  return folder === "." ? "" : folder.split("/").filter(Boolean).join("/");
}

// the folders each file's `sys.path` calls add, a Map of file to root-relative folders in the order Python searches
// them, the last insert first, the appends after in line order; a root named by an import counts only when the file
// it comes from sets that name to the root
function listAddedFolders(root, rows) {
  const rootNames = new Map(rows.map((r) => [r.file, r.rootNames]));
  const namesRoot = (file, via) => via === null || (rootNames.get(findBaseFile(root, file, via)) ?? []).includes(via.rest.at(-1));
  const added = new Map();
  for (const { file, sysPath } of rows) {
    const byLine = [...sysPath].sort((a, b) => a.line - b.line);
    const ordered = [...byLine.filter((s) => s.front).reverse(), ...byLine.filter((s) => !s.front)];
    const folders = ordered.filter((s) => namesRoot(file, s.via)).map((s) => joinLiteralParts(s.parts)).filter((f) => f !== null);
    added.set(file, [...new Set(folders)]);
  }
  return added;
}

// the file a class base comes from, root-relative: the longest of its dotted path's prefixes, its own name left off, that
// is a module's file; null for none; `added` the folders the file's `sys.path` calls add
function findBaseFile(root, file, { level, module, rest, added = [] }) {
  const start = findStartFolder(root, file, { module, level, added });
  if (start === null) return null;
  const from = module ? posix.join(start, ...module.split(".")) : start;
  for (let n = rest.length - 1; n >= 0; n--) {
    const found = findModuleFile(root, posix.join(from, ...rest.slice(0, n)));
    if (found) return found;
  }
  return null;
}

// a file's declarations as the port gives them, { name, kind, exported }: exported when its literal `__all__` names it,
// or, with none, when no `_` starts its name
function markExported({ declarations, all }) {
  const exported = all ? (name) => all.includes(name) : (name) => !name.startsWith("_");
  return declarations.map(({ name, kind }) => ({ name, kind, exported: exported(name) }));
}

// the stop for a file the reader could not read
function stopOnUnreadFile({ file, why, line }, version) {
  if (why === "nesting") return nestingStop(file);
  return { stop: `${printable(file)} does not parse under Python ${toMajorMinor(version)}: line ${line}` };
}

const isInt = (n) => Number.isInteger(n) && n >= 0;
const isText = (s) => typeof s === "string" && s.length <= 1024;
const isNames = (n) => n === null || (Array.isArray(n) && n.every(isText));
const isObject = (x) => x !== null && typeof x === "object";
const isModule = (m) => m === null || isText(m);
const isImport = (i) => isObject(i) && isModule(i.module) && isInt(i.level) && isNames(i.names) && isInt(i.line)
  && typeof i.typeOnly === "boolean" && typeof i.stdlib === "boolean";
// the kinds the reader gives a declaration, the port's own but `const`, which Python has not
const KINDS = ["fn", "class", "type", "other"];
const isDeclaration = (d) => isObject(d) && isText(d.name) && KINDS.includes(d.kind);
const isBase = (b) => isObject(b) && isInt(b.level) && isModule(b.module)
  && Array.isArray(b.rest) && b.rest.length > 0 && b.rest.every(isText);
const isSysPathFolder = (s) => isObject(s) && typeof s.front === "boolean" && isInt(s.line)
  && Array.isArray(s.parts) && s.parts.every(isText) && (s.via === null || isBase(s.via));
const isCall = (c) => isObject(c) && isText(c.name) && isInt(c.line);
const isRow = (r, file) => r && r.file === file && Array.isArray(r.imports) && r.imports.every(isImport)
  && Array.isArray(r.clockCalls) && r.clockCalls.every(isCall) && Array.isArray(r.ioCalls) && r.ioCalls.every(isCall)
  && Array.isArray(r.declarations) && r.declarations.every(isDeclaration) && isNames(r.all)
  && Array.isArray(r.bases) && r.bases.every(isBase) && Array.isArray(r.rootNames) && r.rootNames.every(isText)
  && Array.isArray(r.sysPath) && r.sysPath.every(isSysPathFolder);
const isStop = (s, files) => isObject(s) && files.includes(s.file) && ["syntax", "nesting"].includes(s.why) && isInt(s.line);

// the reader's output read and checked against its shape: one row per file given, in order; null when it is not
function parseReaderOutput(output, files) {
  let parsedOutput;
  try { parsedOutput = JSON.parse(output); } catch { return null; }
  const versioned = isObject(parsedOutput) && typeof parsedOutput.version === "string" && PYTHON_3.test(parsedOutput.version);
  if (!versioned) return null;
  if ("stop" in parsedOutput) return isStop(parsedOutput.stop, files) ? parsedOutput : null;
  const rows = Array.isArray(parsedOutput.files) ? parsedOutput.files : [];
  const fits = rows.length === files.length && rows.every((r, n) => isRow(r, files[n]));
  return fits ? parsedOutput : null;
}

// a module's file under `base`, root-relative: its package's `__init__.py`, else its `.py`; null for none
function findModuleFile(root, base) {
  const candidates = [posix.join(base, "__init__.py"), ...(base ? [`${base}.py`] : [])];
  return candidates.find((f) => isFile(join(root, f))) ?? null;
}

// whether a dotted module resolves whole under the folder `place`: to a module's file, or to a folder, a namespace package
function isWholeAt(root, place, module) {
  const base = posix.join(place, ...module.split("."));
  return findModuleFile(root, base) !== null || isDir(join(root, base));
}

// whether a dotted module's first part is a file or a folder at the root or in `src/`: a name the repository owns there
function isFirstPartAtRoot(root, module) {
  const first = module.split(".")[0];
  return ["", "src"].some((p) => isFile(join(root, p, `${first}.py`)) || isDir(join(root, p, first)));
}

// the folders above `folder`, nearest first, the root left out: `tests/road` gives `tests`
function foldersAbove(folder) {
  const parts = folder ? folder.split("/") : [];
  return parts.slice(0, -1).map((_, k, above) => above.slice(0, above.length - k).join("/"));
}

// the folder an import's dotted path starts from: a relative one's by its dots; an absolute one's, the first search place
// where its whole name resolves, the folders `added` by the file's `sys.path` calls after its own; null when none does
function findStartFolder(root, file, { module, level, added = [] }) {
  const own = posix.dirname(file) === "." ? "" : posix.dirname(file);
  if (level > 0) return posix.join(own, ...Array(level - 1).fill(".."));
  const places = [own, ...added, ...foldersAbove(own), "", ...(isDir(join(root, "src")) ? ["src"] : [])];
  return places.find((p) => isWholeAt(root, p, module)) ?? null;
}

// One import row as the port's imports: { name, to, typeOnly }, or { name, to: null, typeOnly, local } where it does not
// resolve; a `from` import gives one per submodule it names, and one for its module when it names anything else.
function resolveImport(root, file, row) {
  const dotted = ".".repeat(row.level) + (row.module || "");
  const start = findStartFolder(root, file, row);
  if (start === null) return [{ name: dotted, to: null, typeOnly: row.typeOnly, local: isFirstPartAtRoot(root, row.module) }];
  const base = row.module ? posix.join(start, ...row.module.split(".")) : start;
  if (row.names === null) return [resolveModuleImport(root, base, { name: dotted, typeOnly: row.typeOnly })];
  const subs = row.names.filter((n) => n !== "*").map((n) => ({ n, to: findModuleFile(root, posix.join(base, n)) })).filter((s) => s.to);
  const joined = (n) => (row.module ? `${dotted}.${n}` : `${dotted}${n}`);
  const out = subs.map((s) => ({ name: joined(s.n), to: s.to, typeOnly: row.typeOnly }));
  return subs.length < row.names.length ? [...out, resolveModuleImport(root, base, { name: dotted, typeOnly: row.typeOnly })] : out;
}

// the import of the module at `base` itself: an edge to its file; none, and not unresolved, for a folder with no
// `__init__.py`, a namespace package, which has no file of its own; else unresolved and the repository's own
function resolveModuleImport(root, base, { name, typeOnly }) {
  const to = findModuleFile(root, base);
  if (to) return { name, to, typeOnly };
  return { name, to: null, typeOnly, local: !isDir(join(root, base)) };
}
