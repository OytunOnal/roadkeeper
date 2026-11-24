// @level infrastructure
// Roadkeeper — Node's coverage, read for the test sweep: NODE_V8_COVERAGE set to a folder makes every node process a run
// starts, its children's children too, write V8's block coverage there as JSON when it exits. Reads only that folder's
// plain files, at most MAX_DATA_FILES, each under DATA_CAP; of each script only a `file:` URL that `codeFile` names as
// the project's code, its source a plain file with no link on the way from the root, under SOURCE_CAP. A data file
// past its cap, or no JSON, a source past its cap and a `file:` URL naming no file are skipped and counted, never read;
// a folder that cannot be listed is said as code not read.

import { lstatSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { noLinkOnTheWay } from "../../_files.mjs";
import { listDataFiles, MAX_DATA_FILES } from "./data-files.mjs";
import { Reach } from "./reached-lines.mjs";
import { reachedLines } from "./v8-reached-lines.mjs";

const DATA_CAP = 256 * 1024 * 1024; // bytes of one coverage file: Node's internals and every script a process loaded
const SOURCE_CAP = 16 * 1024 * 1024; // bytes of one source file read for its lines: far above any hand-written file
const FILE_URL = "file:"; // the scheme of a script loaded from disk: node: and data: scripts are no project code
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff); // dropped from a source's start, as Node drops it

// A plain file's text at `path` under `cap`, its byte-order mark dropped as Node drops it before compiling; null when
// it is no plain file, is over the cap or cannot be read. Its line ends are kept, unlike _files.mjs' readPlainFile:
// V8's offsets count each CRLF's two characters, and rewriting them would shift every range after.
function readPlainText(path, cap) {
  try {
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.size > cap) return null;
    const text = readFileSync(path, "utf8");
    return text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  } catch { return null; }
}

// The coverage file's scripts, or null when it cannot be read as V8's coverage.
function readScripts(path) {
  const text = readPlainText(path, DATA_CAP);
  try { const data = text === null ? null : JSON.parse(text); return Array.isArray(data?.result) ? data.result : null; }
  catch { return null; }
}

// A script URL read: { code }, its path from the root when it is the project's code (`codeFile`'s answer), else
// null; { code: null, unreadable: true } for a `file:` URL naming no file.
function codePathOf(codeFile, url) {
  if (typeof url !== "string" || !url.startsWith(FILE_URL)) return { code: null };
  try { return { code: codeFile(fileURLToPath(url)) }; } catch { return { code: null, unreadable: true }; }
}

// The project's scripts of these coverage files' scripts: { scripts, unreadable }, each script { code, functions },
// `code` its path from the root, `unreadable` the count of scripts whose `file:` URL names no file.
function projectScripts(scripts, codeFile) {
  const urlsRead = new Map();
  for (const url of new Set(scripts.map((s) => s?.url))) urlsRead.set(url, codePathOf(codeFile, url));
  const project = scripts.filter((s) => urlsRead.get(s?.url).code !== null && Array.isArray(s.functions))
    .map((s) => ({ code: urlsRead.get(s.url).code, functions: s.functions }));
  return { scripts: project, unreadable: scripts.filter((s) => urlsRead.get(s?.url).unreadable).length };
}

// Each source the scripts name, read once: a Map of its path from the root to its text, null for one skipped.
function readSources(root, scripts) {
  const sources = new Map();
  for (const code of new Set(scripts.map((s) => s.code))) {
    const file = join(root, ...code.split("/"));
    sources.set(code, noLinkOnTheWay(root, file) ? readPlainText(file, SOURCE_CAP) : null);
  }
  return sources;
}

// What Node's coverage of one run wrote into `folder`: { reached, skipped, unread }, `reached` the lines of the
// project's code any node process reached (a reach), `skipped` the data files, sources and script URLs not read,
// `unread` { language, unlisted } when the folder could not be listed, `unlisted` the error's code, else null.
// `project`: { root, codeFile },
// `codeFile(absolutePath)` its path from the root when it is the project's code, else null.
function read(folder, project) {
  const { names, unlisted } = listDataFiles(folder);
  const parsed = names.slice(0, MAX_DATA_FILES).map((name) => readScripts(join(folder, name)));
  const { scripts, unreadable } = projectScripts(parsed.filter(Boolean).flat(), project.codeFile);
  const sources = readSources(project.root, scripts);
  const reached = new Reach();
  for (const { code, functions } of scripts) if (sources.get(code) !== null) reached.add(code, reachedLines(sources.get(code), functions));
  const unreadData = parsed.filter((s) => !s).length + Math.max(0, names.length - MAX_DATA_FILES);
  const skipped = unreadData + unreadable + scripts.filter((s) => sources.get(s.code) === null).length;
  return { reached, skipped, unread: unlisted ? { language: "JavaScript", unlisted } : null };
}

// The run's folder made: the variables a run is started under to write its coverage into `folder`.
function makeRunFolder(folder) {
  mkdirSync(folder, { recursive: true });
  return { NODE_V8_COVERAGE: folder };
}

// Node's coverage reader: its name, its run's folder made, and its read.
export const nodeCoverage = { name: "node", makeRunFolder, read };
