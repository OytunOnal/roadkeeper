#!/usr/bin/env node
// @level main
// Roadkeeper — the version forecast command: prints each open milestone's slices counted, room, bump and forecast title,
// then the slices with no kind. Steward runs it when a slice is placed and when a milestone closes.
//
// Reads the tracker of the tree --root names, resolved against the working directory, else of the directory it is run
// in; a --root with no value, given twice or naming no directory is refused, nothing read (scripts/_root-option.mjs).
// The tracker (scripts/_tracker.mjs) is read live, or with --offline or when `gh` fails, the last snapshot, refused
// when it keeps no close reasons; in a linked worktree with none, its main checkout's, which a line says. With --apply,
// read live only, it renames on the tracker each open milestone whose title changes, says each rename, and exits
// non-zero when the tracker refuses one.

import { rootOption } from "./_root-option.mjs";
import { readTracker, renameMilestones, snapshotSource } from "./_tracker.mjs";
import { forecast, forecastLines, keepsCloseReasons, renameLines } from "./_version-forecast.mjs";

// what --help prints: how to run the command
const USAGE = `Usage: node version-forecast.mjs [--offline] [--apply] [--root <path>] [milestone number ...]
  --offline  read the last snapshot, not the tracker
  --apply    rename each open milestone whose title changes; a live read only
  --root     the tree whose tracker is read, resolved against the working directory; none: the working directory
  number     the open milestones' new order, each named once; none: by their titles' versions
  --help     print this usage and run nothing, whatever else is given`;

const fail = (line) => { process.stderr.write(`version-forecast.mjs: ${line}\n`); process.exit(1); };

// --offline, --apply, and the open milestones' new order as their numbers, from the arguments but --root's
function parseArgs(argv) {
  const opts = { offline: false, apply: false, order: [] };
  for (const a of argv) {
    if (a === "--offline") opts.offline = true;
    else if (a === "--apply") opts.apply = true;
    else if (/^[1-9]\d{0,8}$/.test(a)) opts.order.push(Number(a));
    else fail(`unknown option ${a.slice(0, 40)}; give --offline, --apply, --root and milestone numbers`);
  }
  return opts;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) { process.stdout.write(USAGE + "\n"); return; }
  const { root, rest, refused } = rootOption(argv);
  if (refused) fail("--root must name a directory; nothing read");
  const opts = parseArgs(rest);
  const tracker = readTracker(root, opts.offline);
  if (!tracker.snap) fail(`no tracker read and no snapshot (gh: ${tracker.error || "offline"})`);
  if (opts.apply && !tracker.live) fail(`--apply renames only from a live read (gh: ${tracker.error || "offline"})`);
  if (!tracker.live && !keepsCloseReasons(tracker.snap)) fail("the snapshot keeps no close reasons, so no closed slice would count; read live");
  if (tracker.error || tracker.fromMainCheckout) {
    const why = tracker.error ? ` (gh: ${tracker.error})` : "";
    process.stderr.write(`version-forecast.mjs: read from ${snapshotSource(tracker)} of ${tracker.snap.fetched || "an unknown date"}${why}\n`);
  }
  const result = forecast(tracker.snap, opts.order);
  if (result.refused) fail(`the order given is not the open milestones' — ${result.refused}`);
  process.stdout.write(forecastLines(result).join("\n") + "\n");
  if (!opts.apply) return;
  const renames = result.milestones.filter((m) => m.next !== null).map((m) => ({ number: m.number, from: m.title, to: m.next }));
  const steps = renameMilestones(root, renames);
  const lines = renameLines(steps);
  if (lines.length) process.stdout.write(lines.join("\n") + "\n");
  if (steps.some((s) => s.error)) process.exit(1);
}

main();
