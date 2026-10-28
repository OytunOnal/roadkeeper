#!/usr/bin/env node
// @level main
// Roadkeeper — the structure stamp, the last step of a project's structure command, run in the project root:
// `node <roadkeeper>/scripts/structure-stamp.mjs`. It writes into structure.json each module's `files` and the
// files no module holds (`loose`), read from disk, and the `digest` of their contents, so structure-check.mjs can tell a
// graph older than its code (scripts/structure/, `stamp`).
//
// Writes: docs/roadkeeper/structure.json only, in place, keeping every other field — and only when no folder on the way to
// it is a link. Runs no command and asks git nothing. Takes no argument: any prints the usage line and exits 2, writing
// nothing. Exits 1, writing nothing, on any stop; each says why. Stops on docs/roadkeeper missing or a link, a structure.json
// that is not an object with modules, and a disk-unread line. A stale or hard line never stops it.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { stamp } from "./structure/structure.mjs";

if (process.argv.length > 2) { process.stdout.write("usage: structure-stamp.mjs\n"); process.exit(2); }
const root = process.cwd();
const say = (line) => { process.stdout.write(`structure-stamp: ${line}\n`); };
const stamped = stamp(root);
if (stamped.refused) {
  if (stamped.refused.length) process.stdout.write(stamped.refused.join("\n") + "\n");
  say(stamped.why ? `${stamped.why} — nothing written` : "nothing written");
  process.exit(1);
}
writeFileSync(join(root, "docs", "roadkeeper", "structure.json"), stamped.text);
say(`${stamped.files} files, digest ${stamped.digest.slice(0, 12)}`);
