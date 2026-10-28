// @level infrastructure
// Roadkeeper — the staleness digest's walk and hash: every file under a project's modules, and every source file no module
// holds, read from disk, and one SHA-256 over their paths and contents. The stamp writes it into structure.json with
// the files; the check computes it again, so a graph older than its code is seen without asking git anything (a
// repository's own config cannot run through it). Which files are read is staleness-digest.mjs's.
//
// Walks the project root and each declared module's folder through disk-reads.mjs's walk; skips what `## Ignore`
// names. Line endings are read as LF, so git's CRLF checkout reads the same. Bounded by the walk's bounds and MAX_BYTES
// read — past any bound it says so and gives no digest.
//
// The reader, diskFacts, is the structure report's one door to the disk: it refuses what the digest refuses, a link and
// a bound passed.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPlainDir } from "../../_files.mjs";
import { factsOf, stalenessDigest } from "./staleness-digest.mjs";
import { walkFiles } from "./disk-reads.mjs";

// a project's source: a few hundred megabytes at most, read in a few seconds
const MAX_BYTES = 256 * 1024 * 1024;

// SHA-256 of a file with every CRLF read as LF, hashed in slices of the buffer it was read into — no second copy, so a
// large file costs its size once
function lfHash(body) {
  const h = createHash("sha256");
  let from = 0;
  for (let i = body.indexOf(13); i >= 0; i = body.indexOf(13, i + 1)) {
    if (body[i + 1] === 10) { h.update(body.subarray(from, i)); from = i + 1; }
  }
  h.update(body.subarray(from));
  return h.digest("hex");
}

// { files: Map(module → sorted paths), loose, digest, over, missing, ignored } — `loose` the sorted source files no
// module holds that no `tests` pattern names, the walk started at the root; `over` names the bound passed, and then the
// digest is null; `missing` lists the modules with no plain folder on disk (absent, a file, or a link on the way);
// `ignored` is the set of paths ## Ignore took out
function digestOf(root, modulePaths, { ignore, tests }) {
  const scope = stalenessDigest(modulePaths, { ignore, tests, loose: true });
  const missing = [], plain = [];
  for (const m of scope.walked) (isPlainDir(root, join(root, m)) ? plain : missing).push(m);
  // every file met counts toward the bound, an ignored one or one never read too: the walk's cost is every file it meets
  const walked = walkFiles(root, ["", ...plain]), all = [], skipped = new Set();
  let bytes = 0, over = walked.over;
  for (const { rel, size } of over ? [] : walked.files) {
    if (!scope.reads(rel)) continue;
    if (scope.ignored(rel)) { skipped.add(rel); continue; }
    if (bytes + size > MAX_BYTES) { over = `more than ${MAX_BYTES} bytes read`; break; }
    let body;
    try { body = readFileSync(join(root, rel)); } catch { continue; }
    bytes += body.length;
    all.push([rel, lfHash(body)]);
  }
  if (over) return { ...scope.grouped([]), digest: null, over, missing, ignored: skipped };
  all.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const h = createHash("sha256");
  for (const [p, d] of all) { h.update(p); h.update("\0"); h.update(d); h.update("\n"); }
  return { ...scope.grouped(all.map(([p]) => p)), digest: h.digest("hex"), over: null, missing, ignored: skipped };
}

// The disk's facts about the model's modules (staleness-digest.mjs, factsOf), read from the project root.
export function diskFacts(root, sm) {
  return factsOf(sm, digestOf(root, sm.modules.map((m) => m.path), { ignore: sm.ignore, tests: sm.tests }));
}
