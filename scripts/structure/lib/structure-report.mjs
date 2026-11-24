// @level application
// Roadkeeper — the structure report's use case: the check over the declared structure, the disk's facts, the versions the
// tracker snapshot shows closed and today, and the lines the check command prints, said through the words the module's
// entry hands in as one object, `words`: { reportLines, the report's lines; structureUnread, the line saying a structure
// file is not read } (report-lines.mjs).

import { judgingOptions, rulings } from "./rulings.mjs";

// the check's last line when a structure file is not read
const VIOLATIONS = "structure: violations";
// the structure files, as the tab's unread list names them
const FILES = ["docs/roadkeeper/dependency-rules.md", "docs/roadkeeper/structure.json"];
const notRead = (where) => ({ where, what: "missing, a link, or over the file cap — not read" });

// The report of a project that declares no structure, said in `words`: no docs/roadkeeper folder, or neither structure
// file in it.
export function undeclaredReport(words) {
  return { declared: false, model: null, check: null, unread: FILES.map(notRead), lines: [words.structureUnread, VIOLATIONS], failed: true };
}

// The report over the model `sm`, said in `words`, from what was read: `read.md` and `read.js`, each structure file's text or null, and
// `read.facts`, the disk's (disk-facts.mjs, diskFacts). Returns { declared, model, check (the rulings' whole result),
// unread (the structure files not read, each { where, what }), lines (what the check prints), atop (the lines the
// Architecture tab opens on), diskUnread (the lines the disk gave), failed (whether it exits 1) }, the lines as
// words.reportLines writes them. `options`, the caller's judging options, built once (rulings.mjs, judgingOptions). A
// file not read, or empty, stops the lines at the unread line; the check still runs, for the tab.
export function structureReport({ sm, words }, read, options = {}) {
  const judging = judgingOptions(options);
  const check = rulings(sm, judging);
  const reportedLines = words.reportLines({ sm, facts: read.facts }, check, judging);
  const unread = FILES.filter((f, i) => [read.md, read.js][i] == null).map(notRead);
  const stopped = !read.md || !read.js;
  return {
    declared: true, model: sm, check, unread, ...reportedLines,
    lines: stopped ? [words.structureUnread, VIOLATIONS] : reportedLines.lines, failed: stopped || reportedLines.failed,
  };
}
