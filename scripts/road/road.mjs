// @level main
// Roadkeeper — The Road's entry, its one interface (ADR 0005): the page and the road model. It wires the page's sources
// (infrastructure), the road model (domain), the page's HTML (presentation) and the structure module's Architecture tab
// part, and draws the page under its budget a size step at a time; everything under lib/ is private.
//
// What the module reads, under the project root: the page's sources (lib/page-sources.mjs) and, through the structure
// module's entry, the structure files; under the plugin's root, the token file. The tracker's read and today are the
// caller's. Writes nothing.

import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { architecture, report } from "../structure/structure.mjs";
import { modelSources, pageSources, pageTokens } from "./lib/page-sources.mjs";
import { roadModel as modelOf } from "./lib/road-model.mjs";
import { MAX_PAGE, roadHtml } from "./lib/road-html.mjs";
import { onePagerName } from "./lib/road-progress.mjs";

const PAGE_BUDGET = 15.5 * 1024 * 1024; // a draw above this is redrawn at the next size step
// found from this file, so every project's Road draws from the plugin's one design
const PLUGIN_TOKENS = fileURLToPath(new URL("tokens.css", import.meta.url));

// Draw from the first size step, the Architecture tab's part drawn at each from the structure report (null with no
// structure declared), until the page is under PAGE_BUDGET. The attempt where the tab leaves its drawing out drops the
// issues' detail too and is the last: a repository's files never stop the page from being written. With no structure,
// the second attempt is that last one.
function drawBySizeStep(view, structure) {
  for (let sizeStep = 0; ; sizeStep++) {
    const part = structure && architecture(structure, { sizeStep, linkBase: view.linkBase, cap: MAX_PAGE });
    const last = structure ? part.leftOut : sizeStep > 0;
    const html = roadHtml({ ...view, structure: part }, { index: sizeStep, detail: !last });
    if (last || Buffer.byteLength(html, "utf8") <= PAGE_BUDGET) return html;
  }
}

// The road model of `snap`, the tracker snapshot, on `today` (YYYY-MM-DD), with the page's sources read from `root`
// (lib/road-model.mjs). It carries the waiting threshold, `waiting.lateAfterDays`.
export function roadModel(root, snap, today) {
  return modelOf(snap, today, modelSources(root));
}

// The page of the project at `root`: { html }, or { refused }, the line to say when the page is over the cap even
// past the last size step. `tracker` is the tracker's read, { snap, live, error }, with `snapshotPath`, the snapshot's
// path the page names when there is none; `today` is YYYY-MM-DD; `linkBase` starts file links; `tokensPath` the token
// file, the plugin's when not given.
export function roadPage(root, tracker, { today, linkBase, tokensPath = PLUGIN_TOKENS }) {
  const snap = tracker.snap;
  const sources = pageSources(root);
  const repoName = snap && snap.repo ? snap.repo.split("/")[1] : "";
  const structure = report(root, { snapshot: snap, today });
  const html = drawBySizeStep({
    road: snap ? modelOf(snap, today, sources) : null,
    read: { live: tracker.live, error: tracker.error, snapshotPath: tracker.snapshotPath },
    architecture: sources.architecture,
    onePager: sources.onePager,
    tokens: pageTokens(tokensPath),
    projectName: onePagerName(sources.onePager) || repoName || basename(root) || "This project",
    linkBase,
  }, structure.declared ? structure : null);
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_PAGE) return { refused: `the page is ${(bytes / 1024 / 1024).toFixed(1)} MB even at the tightest fold, over the ${MAX_PAGE / 1024 / 1024} MB cap — no page written.` };
  return { html };
}
