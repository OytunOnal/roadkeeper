// @level presentation
// Roadkeeper — The Road's page, a deep module nested in The Road; this is its entry, its one interface (roadHtml,
// MAX_PAGE), and everything under lib/ is private: the HTML drawn from the road model, with no decisions of its own.
//
// roadHtml(view, sizeStep) draws it. `view` holds the road model (../lib/road-model.mjs, or null with no snapshot), how
// the tracker was read, the sources read from disk (../lib/page-sources.mjs), the Architecture tab's structure part as the
// structure module drew it, the project's name and the base of file links; `sizeStep` the attempt's size step.
// The page loads two things from outside: the IBM Plex faces from Google Fonts, with a system fallback stack, and the
// mermaid renderer from cdnjs, only when the host did not draw the diagrams itself.
//
// Tracker text is a stranger's: every title and body is escaped.
//
// Under the title, the lead: what the project is, the one-pager's first paragraph. Then three tabs: Progress (the
// counters, the current milestone's bar and the flags, lib/road-counters.mjs's; the key, lib/road-key.mjs's; the groups
// along the rail, lib/road-progress.mjs's; the versions and the bets, lib/road-tables.mjs's), Waiting on you (the open
// waiting-on-you issues, today's first, then those set aside), both under the tracker's read line, Architecture (the
// no-structure line, or the structure part: the report's unread, stale and level-name lines and the structure drawing;
// then ARCHITECTURE.md).

import { functionSources } from "../../_function-sources.mjs";
import { esc, plural } from "../../_text.mjs";
import { describeFailure } from "../../_tracker-failure-kinds.mjs";
import { shownLeadOf } from "../lib/issue-body.mjs";
import { dayOf } from "../lib/road-model.mjs";
import { SET_ASIDE_WORDS } from "../lib/waiting-words.mjs";
import * as diagramClientFunctions from "./lib/diagram-client.mjs";
import { inline, markdownSubset } from "./lib/markdown-subset.mjs";
import * as roadClientFunctions from "./lib/road-client.mjs";
import { renderBar, renderFlags, renderKpis } from "./lib/road-counters.mjs";
import { renderLegend } from "./lib/road-key.mjs";
import { renderGroups } from "./lib/road-progress.mjs";
import { roadIcon } from "./lib/road-icon.mjs";
import { ROAD_STYLE } from "./lib/road-style.mjs";
import { renderBets, renderVersionsTable } from "./lib/road-tables.mjs";
import { YOU_TAB, issueRef, issueTitleLink, longDate } from "./lib/road-words.mjs";
import * as tabsClientFunctions from "./lib/tabs-client.mjs";

export const MAX_PAGE = 16 * 1024 * 1024;    // the artifact cap: a page is never written above it

// ------------------------------------------------------------------ small helpers

// A provenance line names a file first: `docs/roadkeeper/x.md · ...`. That name becomes a link from the link base; the rest
// of the line stays text.
const FILE_TOKEN = /^(docs\/roadkeeper\/[A-Za-z0-9_./-]+|[A-Za-z0-9_-]+\.(?:md|html))/;

function srcLink(base, text) {
  const line = String(text == null ? "" : text);
  const m = FILE_TOKEN.exec(line);
  if (!m) return esc(line);
  return `<a href="${esc(base + m[1])}">${esc(m[1])}</a>${esc(line.slice(m[1].length))}`;
}

// What a failed read says, by its kind (describeFailure), as HTML; a kind with no words stops the draw.
const sayFailure = (kind) => inline(describeFailure(kind));

// the repository the snapshot `s` names, linked to its issues when its address is known; "the tracker" with none
function nameRepo(s) {
  if (!(s && s.repo)) return "the tracker";
  return s.url ? `<a href="${esc(s.url)}/issues" rel="noopener">${esc(s.repo)}</a>` : esc(s.repo);
}

// Where the page's data came from, said first. `read` is how the tracker was read; `road` null means no snapshot. A
// failed read carries its kind (the tracker's read always names one): one with none stops the draw.
function trackerLine(read, road) {
  const s = road && road.tracker;
  const when = s && s.fetched ? `${longDate(dayOf(s.fetched))} ${s.fetched.slice(11, 16)} UTC` : "an unknown date";
  const repo = nameRepo(s);
  if (read.error && !read.failure) throw new Error("a failed tracker read carries no kind");
  const failed = Boolean(read.failure);
  if (read.live) return `<p class="s">Read from ${repo} on ${when}.</p>`;
  if (s && !failed) return `<p class="s">Drawn offline from the snapshot of ${repo}, ${when}.</p>`;
  if (s) return `<p class="unread">The tracker could not be read (${sayFailure(read.failure)}); drawn from the snapshot of ${when}.</p>`;
  return `<p class="unread">The tracker could not be read${failed ? ` (${sayFailure(read.failure)})` : ""}, and there is no snapshot at ${esc(read.snapshotPath)}: the road is empty.</p>`;
}

function renderRoad(view, sizeStep) {
  const road = view.road;
  const out = [trackerLine(view.read, road)];
  if (!road) return out.join("\n");
  out.push(renderKpis(road), renderBar(road), renderFlags(road), renderLegend(),
    `<h2>Every issue, by milestone</h2>`, renderGroups(road, sizeStep),
    renderVersionsTable(road), renderBets(road));
  return out.filter(Boolean).join("\n");
}

// The tracker's name where an answer goes: GitHub for github.com, else its host, or "the tracker" with no address the
// URL parser reads.
function trackerName(url) {
  const host = URL.canParse(url || "") ? new URL(url).hostname : "";
  if (!host) return "the tracker";
  return host === "github.com" ? "GitHub" : host;
}

// What an orange card is, said under the read line while a card of today's is drawn: one waiting past the threshold,
// `days`.
const orangeLine = (days) => `<p class="s">An orange card has waited on you for more than ${esc(plural(days, "day"))}.</p>`;

// Where an answer to a card goes, said under the orange line while any card is drawn.
const answerLine = (url) => `<p class="s">To answer one, click its number to open the issue on ${esc(trackerName(url))}, and write your answer there as a comment.</p>`;

// The line over the cards set aside, in the read line's look.
const SET_ASIDE_LINE = `<p class="s">${SET_ASIDE_WORDS[0].toUpperCase()}${SET_ASIDE_WORDS.slice(1)}, so nothing to do yet:</p>`;

// What the tab says with no card of today's: nothing today while some are set aside, else nothing at all.
const makeNothingLine = (setAside) => `<p>Nothing is waiting on you${setAside.length ? " today" : ""}.</p>`;

// A waiting card: issue `i`'s title linked, `ageHtml` under it, then its body.
const drawWaitingCard = (i, ageHtml) => `<div class="card${i.late ? " late" : ""}"><h3>${issueTitleLink(i)}</h3>${ageHtml}${markdownSubset(i.body, 4)}</div>`;

// Waiting on you: today's cards, each with its age, then, under their line, those set aside, whole, with none; the
// answered fold.
function renderYou(view) {
  const road = view.road;
  const out = [trackerLine(view.read, road)];
  if (!road) return out.join("\n");
  const { open, setAside, answered } = road.waiting;
  if (open.length) out.push(orangeLine(road.waiting.lateAfterDays));
  if (open.length || setAside.length) out.push(answerLine(road.tracker.url));
  // the tab's heading for a screen reader, so its cards' h3 skip no level under the page's h1; the nav shows its name
  out.push(`<h2 class="unseen">${esc(YOU_TAB.name)}</h2>`);
  // a card's age: since today, for N days, or, with no day known, that the tracker gave none
  const sayAge = (age) => {
    if (age === null) return `waiting since a day ${trackerName(road.tracker.url)} did not give`;
    return age === 0 ? "waiting since today" : `waiting for ${plural(age, "day")}`;
  };
  // a card of today's, its age under its title; a set-aside card, none
  const drawTodaysCard = (i) => drawWaitingCard(i, `<p class="s">${esc(sayAge(i.age))}</p>`);
  const drawSetAsideCard = (i) => drawWaitingCard(i, "");
  if (!open.length) out.push(makeNothingLine(setAside));
  out.push(open.map(drawTodaysCard).join(""));
  if (setAside.length) out.push(SET_ASIDE_LINE, setAside.map(drawSetAsideCard).join(""));
  if (answered.length) out.push(`<details class="fold"><summary>${plural(answered.length, "answered issue")}</summary><ul>${answered.map((i) => `<li>${issueRef(i)} ${inline(i.title)} <span class="n">${esc(i.closedAt ? `closed on ${longDate(dayOf(i.closedAt))}` : "closed")}</span></li>`).join("")}</ul></details>`);
  return out.join("\n");
}


// ------------------------------------------------------------------ the page

// The page's script, `ids` its tabs in order: every function of the three client files, each by its own source, in one
// scope; its value is the one entry, roadClient. Where the document has no tabs, as in a suite's scope, the clients stay
// still. Each client runs in its own try, so a throw in one leaves the other running; the first throw is thrown again
// once both ran, for the console.
const roadScript = (ids) => `(function(){\n${functionSources(roadClientFunctions)}\n${functionSources(tabsClientFunctions)}\n${functionSources(diagramClientFunctions)}
if (document.querySelector('nav.tabs')) {
  var thrown = null;
  try { tabsClient(${JSON.stringify(ids)}); } catch (e) { thrown = e; }
  try { diagramClient(); } catch (e) { thrown = thrown || e; }
  if (thrown) throw thrown;
}
return roadClient;
})();`;

// What the Architecture tab opens on: with no structure declared, the line saying so; else the structure part's own.
function archAtop(struct) {
  if (!struct) return `<p class="note">No structure is declared: there is no docs/roadkeeper/dependency-rules.md. Roadkeeper's slice skill, <code>references/structure.md</code>, Adopting, sets one up.</p>`;
  return struct.atop;
}

// The page's title, its heading and the browser tab's, one line
const titleOf = (name) => `The Road for ${name}`;

// The page's head: the doctype first, so a browser draws the page in standards mode, not quirks; laid out at the
// device's width, named for the project, its icon drawn in the token file's colours, its fonts and its style: the token
// file's text, `tokenCss`, null when unread, The Road's, then the structure part's.
const pageHead = (name, tokenCss, struct) => [
  `<!doctype html>`,
  `<meta charset="utf-8">`,
  `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  `<title>${esc(titleOf(name))}</title>`,
  roadIcon(tokenCss),
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">`,
  `<style>${tokenCss == null ? "" : tokenCss + "\n"}${ROAD_STYLE}${struct ? struct.css : ""}
</style>`,
].join("\n");

// The page's lead, under its title: the one-pager's first paragraph, made as an issue's Summary is, drawn inline;
// none with no one-pager read, or no paragraph in it.
function leadOf(onePager) {
  const lead = shownLeadOf(onePager);
  return lead ? `<p class="lead">${inline(lead)}</p>` : "";
}

// One tab's link, `count` what waits on it: with something waiting, a badge, and a name saying the count apart from
// its words.
const tabLink = ([id, label, count]) => (count
  ? `<a href="#${id}" aria-label="${esc(label)}, ${count} waiting">${esc(label)}<span class="badge">${count}</span></a>`
  : `<a href="#${id}">${esc(label)}</a>`);

// The page. `view`: { road, read: { live, error, failure, snapshotPath }, architecture, onePager, tokens, structure,
// projectName, linkBase }, where `onePager` is the one-pager's text, null when unread, `tokens` is the token file,
// { path, css }, `css` null when unread, and `structure` the Architecture tab's part the structure module drew at this
// size step ({ atop, html, css, js, leftOut }), or null with no structure declared.
// `sizeStep`, the attempt's: { index, past the first said; detail, whether "more" opens an issue's detail }.
export function roadHtml(view, sizeStep) {
  const name = view.projectName;
  const src = (text) => srcLink(view.linkBase, text);
  const waiting = view.road ? view.road.counters.waiting : 0;
  const tabs = [["road", "Progress", 0], [YOU_TAB.id, YOU_TAB.name, waiting]];
  const arch = view.architecture;
  const archShown = arch && arch.text != null;
  const struct = view.structure;
  if (archShown || struct) tabs.push(["architecture", "Architecture", 0]);

  const nav = `<nav class="tabs" aria-label="Tabs" data-opens="${waiting ? "you" : "road"}">${tabs.map(tabLink).join("")}</nav>`;
  const structHtml = struct ? struct.html : "";
  const tokensRead = view.tokens.css != null;

  const body = [
    `<div class="wrap" lang="en">`,
    tokensRead ? "" : `<p class="unread">The design tokens could not be read at ${esc(view.tokens.path)}: the page is drawn without its colours. Reinstall the Roadkeeper plugin.</p>`,
    `<h1>${esc(titleOf(name))}</h1>`,
    leadOf(view.onePager),
    nav,
    `<main id="main">`,
    `<section class="tab on" id="tab-road">${renderRoad(view, sizeStep)}</section>`,
    `<section class="tab" id="tab-you">${renderYou(view)}</section>`,
    archShown || struct ? `<section class="tab" id="tab-architecture">${archAtop(struct)}${structHtml}${archShown ? `<p class="s">${src(arch.file)}</p>${markdownSubset(arch.text, 2)}` : ""}</section>` : "",
    `</main>`,
    sizeStep.index > 0 ? `<p class="note">This page was folded further to stay under the ${MAX_PAGE / 1024 / 1024} MB cap; every cut is named where it was made.</p>` : "",
    `</div>`,
  ].filter(Boolean).join("\n");

  return [
    pageHead(name, view.tokens.css, struct),
    body,
    `<script>${roadScript(tabs.map((t) => t[0]))}\n</script>`,
    struct && struct.js ? `<script>${struct.js}\n</script>` : "",
    ``,
  ].join("\n");
}
