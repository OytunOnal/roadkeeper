// @level application
// Roadkeeper — the structure report's use case: the check over the declared structure, the disk's facts, the versions the
// tracker snapshot shows closed and today, and the lines the check command prints.

import { STRUCTURE_UNREAD } from "./structure-model.mjs";
import { judgingOptions, rulings } from "./rulings.mjs";

// the check's last line when it fails
const VIOLATIONS = "structure: violations";
// the structure files, as the tab's unread list names them
const FILES = ["docs/roadkeeper/dependency-rules.md", "docs/roadkeeper/structure.json"];
const notRead = (where) => ({ where, what: "missing, a link, or over the file cap — not read" });

// The report of a project that declares no structure: no docs/roadkeeper folder, or neither structure file in it.
export function undeclaredReport() {
  return { declared: false, model: null, check: null, unread: FILES.map(notRead), lines: [STRUCTURE_UNREAD, VIOLATIONS], failed: true };
}

// The report over the model `sm`, from what was read: `read.md` and `read.js`, each structure file's text or null, and
// `read.facts`, the disk's (disk-facts.mjs, diskFacts). Returns { declared, model, check (the rulings' whole result),
// unread (the structure files not read, each { where, what }), lines (what the check prints), failed (whether it exits
// 1) }. `options`, the caller's judging options, built once (rulings.mjs, judgingOptions). A file not read, or empty,
// stops the lines at the unread line; the check still runs, for the tab.
export function structureReport(sm, read, options = {}) {
  const check = rulings(sm, read.facts, judgingOptions(options));
  const unread = FILES.filter((f, i) => [read.md, read.js][i] == null).map(notRead);
  const stopped = !read.md || !read.js;
  return { declared: true, model: sm, check, unread, lines: stopped ? [STRUCTURE_UNREAD, VIOLATIONS] : check.lines, failed: stopped || check.failed };
}
