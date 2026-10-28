#!/usr/bin/env node
// @level main
// Roadkeeper — The Road's command: reads the tracker, has The Road's module draw the page, and writes it.
//   node road.mjs [--offline] [--out <path>] [--root <path>]
//
// Acts on the tree --root names, resolved against the working directory, else the directory it is run in; a --root
// with no value, given twice or naming no directory is refused, nothing written (scripts/_root-option.mjs).
// Reads, from that tree: the tracker (scripts/_tracker.mjs, which writes the snapshot
// docs/roadkeeper/issues.json); The Road's module (scripts/road/) reads the rest. With --offline, or when `gh` fails, the
// last snapshot is drawn and its date said, in a linked worktree with none its main checkout's, which the line says;
// with no snapshot either, the page says so and still draws the Architecture tab.
// Writes: docs/roadkeeper/road.html, or the path given to --out, resolved against the tree, whole; a newer read on disk:
// nothing written, said.

import { join, dirname, relative, resolve, sep } from "node:path";
import { todayLocal } from "./_clock.mjs";
import { insideRoot, replaceFile } from "./_files.mjs";
import { rootOption } from "./_root-option.mjs";
import { SNAPSHOT, newerReadOnDisk, readTracker, snapshotSource } from "./_tracker.mjs";
import { roadPage } from "./road/road.mjs";

const fail = (line) => { process.stderr.write(line + "\n"); process.exit(1); };

// Where a file link starts. With a snapshot naming the repository, its default branch on the code host (GitHub's
// `blob/HEAD`), so the file opens rendered; with none, the project root as seen from the page, so the link resolves
// wherever the page is written inside the project.
const linkBaseOf = (root, outFile, snap) => {
  if (snap && snap.url) return `${snap.url}/blob/HEAD/`;
  const rel = relative(dirname(outFile), root).split(sep).join("/");
  return rel ? rel + "/" : "";
};

// --offline and --out, from the arguments but --root's
function parseArgs(argv) {
  const opts = { offline: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") opts.offline = true;
    else if (a === "--out") { opts.out = argv[++i]; if (!opts.out) fail("road.mjs: --out needs a path"); }
    else if (a.startsWith("--out=")) opts.out = a.slice(6);
    else fail(`road.mjs: unknown option ${a}`);
  }
  return opts;
}

function main() {
  const { root, rest, refused } = rootOption(process.argv.slice(2));
  if (refused) fail("road.mjs: --root must name a directory — no page written.");
  const opts = parseArgs(rest);
  const out = opts.out ? resolve(root, opts.out) : join(root, "docs", "roadkeeper", "road.html");
  if (!insideRoot(root, out)) fail(`road.mjs: --out must name a real path inside ${root}, with no link on the way and not under .git — no page written.`);
  const tracker = readTracker(root, opts.offline);
  const snap = tracker.snap;
  const drawn = roadPage(root, { ...tracker, snapshotPath: SNAPSHOT }, { today: todayLocal(), linkBase: linkBaseOf(root, out, snap) });
  if (drawn.refused) fail(`road.mjs: ${drawn.refused}`);
  // a redraw running beside this one read the tracker later: its page stands
  if (newerReadOnDisk(root, snap)) {
    process.stdout.write(`road.mjs: ${out} not written: a newer read is on disk\n`);
    return;
  }
  const bytes = Buffer.byteLength(drawn.html, "utf8");
  try {
    replaceFile(out, drawn.html);
  } catch (e) {
    fail(`road.mjs: could not write ${out} — ${e.message}`);
  }
  const from = tracker.live ? "the tracker" : snap ? `${snapshotSource(tracker)}${tracker.error ? ` (gh: ${tracker.error})` : ""}` : `nothing (gh: ${tracker.error || "offline"})`;
  process.stdout.write(`${out} — ${(bytes / 1024).toFixed(0)} KB, drawn from ${from}\n`);
}

main();
