// @level application
// Roadkeeper — the graph the structure command writes, from the project's sources (source-files.mjs, sourceFiles) read through the
// Parsers port: the modules with their root files, the levels, the edges and the declarations. A given file the parsers
// did not read as a root stops it, naming the file, as does an import inside the repository that does not resolve: a
// graph with fewer edges than the code would read clean.
//
// The Parsers port, what reads a project's code: ../parsers/parsers.mjs, the project's own parsers; a fake in tests.
// - read(root, files, declared): a promise of { stop }, or of what it read of `files`, root-relative:
//   - tool: the names and versions of the readers that read them, structure.json's `tool`;
//   - read: each file read as a root, { file, imports }, each import { name, to, typeOnly } but a core module's; `to` the
//     root-relative file it resolves to, or null with `local`, whether its name is the repository's own;
//   - heritage: the `implements` and `inheritance` edges between the files given;
//   - declarations: each of `declared`'s top-level declarations, by file, { name, kind, exported };
//   - foundNowhere (optional): the Python imports found in no search place and not in the standard library, each
//     { file, name }, the importing file and the import's name.

import { plural } from "../../_text.mjs";
import { globMatch, printable, readerMessage, underPath } from "./structure-model.mjs";
import { testOf } from "./rulings.mjs";

// a stop names this many unread files, imports or lines and counts the rest: enough to start on
export const SHOWN = 20;
// the count of Python imports found nowhere names this many: enough to see which source root is missed
const NAMED_NOWHERE = 5;
// a thrown message is cut here: a stop stays one readable line
const MESSAGE = 600;
// what an import's name carries beyond printable's characters, kept so a stop names the import as written
const SPECIFIER = "@~+#";

const byEdge = (a, b) => (a.from + "\n" + a.to + "\n" + a.kind < b.from + "\n" + b.to + "\n" + b.kind ? -1 : 1);
const uniqueEdges = (edges) => [...new Map(edges.map((e) => [`${e.from}\n${e.to}\n${e.kind}`, e])).values()].sort(byEdge);

// A thrown error as a stop, in the reader's words.
export const failure = (e) => ({ stop: `could not read the project: ${readerMessage(e && e.message ? e.message : e).slice(0, MESSAGE)}` });

// each module's root files, under the key `entries`: every source file at its root, a test not, the tagged first with
// its level; with more than one, the check names them all (ADR 0005)
function modulesOf(folders, { files, levels, isTest }) {
  return folders.map((path) => {
    const atRoot = files.filter((f) => f.slice(0, f.lastIndexOf("/")) === path && !isTest(f));
    const ordered = [...atRoot.filter((f) => levels[f]), ...atRoot.filter((f) => !levels[f])];
    return { path, entries: ordered.map((file) => (levels[file] ? { file, level: levels[file] } : { file })) };
  });
}

// the `dependency` and `type-only` edges of the files read, and the imports inside the repository that do not resolve;
// an import out of the repository, into node_modules or into what `## Ignore` names is no edge
function importEdges(read, ignore) {
  const leftOut = (to) => to.startsWith("../") || to.split("/").includes("node_modules") || ignore.some((p) => globMatch(p, to));
  const all = read.flatMap(({ file, imports }) => imports.map((i) => ({ ...i, from: file })));
  return {
    unresolved: all.filter((i) => i.to === null && i.local).map((i) => `${printable(i.from)} imports ${printable(i.name, { keep: SPECIFIER })}`),
    edges: all.filter((i) => i.to !== null && !leftOut(i.to)).map((i) => ({ from: i.from, to: i.to, kind: i.typeOnly ? "type-only" : "dependency" })),
  };
}

// The graph of the sources `{ root, folders, files, levels, tests, ignore }` read by `parsers`: { data, foundNowhere },
// structure.json's tool, modules, levels, edges and declarations, unstamped, and the names of the code's Python imports
// found nowhere, a test's aside, each once, sorted; or { stop }. A file no module holds, a test aside, is its own interface: its level and declarations are read
// as an entry's.
export async function dependencyGraph({ root, folders, files, levels, tests, ignore }, parsers) {
  const inModule = (f) => folders.some((m) => underPath(f, m)), isTest = testOf(tests);
  const loose = files.filter((f) => !inModule(f) && !isTest(f));
  const taggedFiles = files.filter((f) => levels[f] && (inModule(f) || !isTest(f)));
  const tagged = Object.assign(Object.create(null), Object.fromEntries(taggedFiles.map((f) => [f, levels[f]])));
  const modules = modulesOf(folders, { files, levels: tagged, isTest });
  const declared = [...modules.flatMap((m) => m.entries.map((e) => e.file)), ...loose];
  let got;
  try { got = await parsers.read(root, files, declared); } catch (e) { return failure(e); }
  if (got.stop) return got;
  const readFiles = new Set(got.read.map((r) => r.file));
  const missed = files.filter((f) => !readFiles.has(f));
  if (missed.length) return { stop: `the parsers did not read ${missed.length} of the ${files.length} files given: ${missed.slice(0, SHOWN).map((f) => printable(f)).join(", ")}` };
  const { edges, unresolved } = importEdges(got.read, ignore);
  if (unresolved.length) return { stop: `${unresolved.length} import(s) inside the repository do not resolve: ${unresolved.slice(0, SHOWN).join(", ")}` };
  const declarations = Object.assign(Object.create(null), Object.fromEntries(declared.map((f) => [f, got.declarations[f] || []])));
  const data = { tool: got.tool, modules, levels: tagged, edges: uniqueEdges([...edges, ...got.heritage]), declarations };
  const codeNowhere = (got.foundNowhere || []).filter((i) => !isTest(i.file)).map((i) => i.name);
  return { data, foundNowhere: [...new Set(codeNowhere)].sort() };
}

// The structure command's closing line for a written graph, stamped `files` files.
export const graphLine = (data, files) =>
  `${data.modules.length} modules, ${Object.keys(data.levels).length} files with a level, ${data.edges.length} edges; ${files} files, digest ${data.digest.slice(0, 12)}`;

// The structure command's line counting the Python imports found nowhere, naming the first NAMED_NOWHERE; null for none.
export function foundNowhereLine(names) {
  if (!names.length) return null;
  const more = names.length > NAMED_NOWHERE ? `, and ${names.length - NAMED_NOWHERE} more` : "";
  const named = names.slice(0, NAMED_NOWHERE).map((n) => printable(n)).join(", ");
  return `${plural(names.length, "Python import")} found in no search place and not in the standard library: ${named}${more}`;
}
