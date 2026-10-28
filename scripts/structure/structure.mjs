// @level main
// Roadkeeper — the structure module's entry, its one interface (ADR 0005): the structure report, the stamp, the graph and
// its parsers, the Architecture tab's part of The Road's page, the plan's drawing and check, and its file patterns' match. It wires the module's
// disk readers and parsers (infrastructure), its use cases and rules (application, domain) and its drawing
// (presentation); everything under lib/ is private.
//
// What the module reads, under the project root: docs/roadkeeper/dependency-rules.md and structure.json, plain files under
// the cap with no link on the way (lib/disk-reads.mjs), and the files under the declared modules and the source files
// no module holds (lib/disk-facts.mjs, lib/source-files.mjs); the parsers read the code (parsers/parsers.mjs). The
// tracker snapshot and today are the caller's to read. Writes nothing.

import { structureModel } from "./lib/structure-model.mjs";
import { readStructureFiles } from "./lib/disk-reads.mjs";
import { diskFacts } from "./lib/disk-facts.mjs";
import { stampFile, stampedText } from "./lib/stamp-file.mjs";
import { sourceFiles } from "./lib/source-files.mjs";
import { planFiles } from "./lib/plan-files.mjs";
import { dependencyGraph, failure, foundNowhereLine, graphLine } from "./lib/dependency-graph.mjs";
import { parsersFrom } from "./parsers/parsers.mjs";
import { structureReport, undeclaredReport } from "./lib/structure-report.mjs";
import { planCheckLines } from "./lib/slice-plan.mjs";
import { planDrawLines } from "./lib/slice-plan-drawing.mjs";
import { architectureTab } from "./architecture-tab/architecture-tab.mjs";

// The structure report of the project at `root`: { declared, model, check, unread, lines, failed }
// (lib/structure-report.mjs). `snapshot`, the tracker snapshot or null, makes an exception due by its closed
// milestones' versions; `today` by its day; `stamping`, the version a stamp is about to write, adds the coming and open
// lines; `snapshotOptional` makes a version exception with no snapshot a note line, not an unread one. A project with no
// plain docs/roadkeeper, or neither structure file in it, declares none.
export function report(root, options = {}) {
  const files = readStructureFiles(root);
  if (files.why || !files.present) return undeclaredReport();
  const sm = structureModel(files.md || "", files.js || "");
  return structureReport(sm, { md: files.md, js: files.js, facts: diskFacts(root, sm) }, options);
}

// structure.json at `root` stamped from its disk: { text, files, digest }, the text to write in its place; or
// { refused, why }, the lines that refused it, or why it was not read.
export const stamp = (root) => stampFile(root);

// The graph of the project at `root`, read by `parsers` (the Parsers port, lib/dependency-graph.mjs), stamped: a
// promise of { text, line, nowhereLine }, structure.json's text to write, the line saying what it holds and the line
// counting the Python imports found nowhere, null for none; or { stop, refused }, why nothing is to be written, after the
// stamp's refused lines when it refused.
export async function graph(root, parsers) {
  try {
    const sources = sourceFiles(root);
    if (sources.stop) return sources;
    const read = await dependencyGraph(sources, parsers);
    if (read.stop) return read;
    const stamped = stampedText(root, read.data, sources.md);
    if (stamped.refused) return { stop: "the stamp refuses the lines above", refused: stamped.refused };
    return { text: stamped.text, line: graphLine(read.data, stamped.files), nowhereLine: foundNowhereLine(read.foundNowhere) };
  } catch (e) { return failure(e); }
}

// The real parsers, dependency-cruiser and TypeScript, and the Astro compiler for an `.astro` file, loaded from the
// node_modules in `packagesDir` by the read that needs them, and the PATH's Python 3 for a `.py` file: { parsers }, a
// missing install the read's stop. `given`, the --packages folder as typed, or null for the project's own.
export const parsers = (packagesDir, { given = null } = {}) => parsersFrom(packagesDir, given);

// The Architecture tab's part of the page, from a declared structure's report (the tab's module,
// architecture-tab/architecture-tab.mjs): { atop, html, css, js, leftOut }. `options`, handed on as they came:
// { sizeStep, linkBase, cap, sizeSteps }: drawn at `sizeStep`, from `sizeSteps` or the tab's own; past the last step
// the drawing is left out under the page's `cap`. `linkBase` starts file links.
export const architecture = (declared, options) => architectureTab(declared, options);

// Whether a path from a project's root, with forward slashes, matches a file pattern: `*` within a segment, `**` across
// whole segments, as dependency-rules.md's patterns read.
export { globMatch } from "./lib/structure-model.mjs";

// The plan in the spec at `specPath`, drawn as mermaid on the structure at `root`: { lines, failed }.
export const planDraw = (root, specPath) => planDrawLines(planFiles(root, specPath, null));

// What was built at `root` against the plan in the spec at `specPath`, from the base structure.json at `basePath`, or
// null when the slice adds structure.json: { lines, failed }.
export const planCheck = (root, specPath, basePath) => planCheckLines(planFiles(root, specPath, basePath), basePath === null);
