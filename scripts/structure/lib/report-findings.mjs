// @level domain
// Roadkeeper — the structure report's findings: how many module files the test patterns take out of the rule, what is
// stale, whether the disk refuses a stamp, and the check's verdict. Pure: structureModel's output (structure-model.mjs)
// and the reader's facts about the disk (diskFacts, disk-facts.mjs) in; report-lines.mjs says them.

import { readsCode } from "./structure-model.mjs";
import { codeFiles } from "./module-records.mjs";
import { testOf } from "./rulings.mjs";

// How many module files the test patterns take out of the dependency rule, so a pattern that swallows the code is seen:
// over `files`, the files on disk by module (the digest's walk), since structure.json's own lists are not in the
// digest; without it over those lists. The check prints it through here.
export function testsTaken(sm, files = null) {
  const isTest = testOf(sm.tests);
  let count = 0, tested = 0;
  const lists = files ? [...files.values()] : sm.modules.map((m) => m.files || []);
  // a module's code files only (SOURCE): a stylesheet or a data file is out of the rule without a pattern
  for (const f of codeFiles(lists.flat()) || []) { count++; if (isTest(f)) tested++; }
  return { files: count, tested };
}

// The one stale finding, or null: no digest stamped (`unstamped`), another digest (`digest`), then a module's files list
// (`module`, with its path), then the files no module holds (`loose`). Past the digest bound nothing is compared: the
// bound is unread. `onDisk`, the files on disk by module.
export function staleFinding(sm, facts, onDisk) {
  if (!sm.digest) return { kind: "unstamped" };
  if (!facts.digest) return null;
  if (facts.digest !== sm.digest) return { kind: "digest" };
  const differs = sm.modules.find((m) => (m.files || []).join("\n") !== (onDisk.get(m.path) || []).join("\n"));
  if (differs) return { kind: "module", path: differs.path };
  return sm.loose.join("\n") !== facts.loose.join("\n") ? { kind: "loose" } : null;
}

// Whether the disk's facts refuse a stamp: a module with no plain folder, the digest bound, or a root file off the walk.
// No facts, or no code read: never.
export const diskRefuses = (sm, facts) =>
  Boolean(facts) && readsCode(sm) && (facts.missing.length > 0 || !facts.digest || facts.offWalk.length > 0);

// The check's verdict from whether it found hard, unread and stale lines: clean; stale when the stale lines are all
// that fails; else violations.
export function verdictOf({ hard, unread, stale }) {
  const noHardOrUnread = !hard && !unread;
  if (noHardOrUnread && !stale) return "clean";
  return noHardOrUnread ? "stale" : "violations";
}
