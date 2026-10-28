// @level presentation
// Roadkeeper — The Road's page: the HTML drawn from the road model, with no decisions of its own.
//
// roadHtml(view, sizeStep) draws it. `view` holds the road model (road-model.mjs, or null with no snapshot), how the
// tracker was read, the sources read from disk (page-sources.mjs), the Architecture tab's structure part as the
// structure module drew it, the project's name and the base of file links; `sizeStep` the attempt's size step.
// The page loads two things from outside: the IBM Plex faces from Google Fonts, with a system fallback stack, and the
// mermaid renderer from cdnjs, only when the host did not draw the diagrams itself.
//
// Tracker text is a stranger's: every title and body is escaped.
//
// Under the title, the lead: what the project is, the one-pager's first paragraph. Then three tabs: Progress (the
// counters; the current milestone's bar; the groups along the rail, road-progress.mjs's; the versions and the bets),
// Waiting on you (the open waiting-on-you issues), both under the tracker's read line, Architecture (the no-structure
// line, or the structure part: the report's unread, stale and level-name lines and the structure drawing; then
// ARCHITECTURE.md).

import { functionSources } from "../../_function-sources.mjs";
import { countInWords, esc, plural } from "../../_text.mjs";
import * as diagramClientFunctions from "./diagram-client.mjs";
import { inline, markdownSubset } from "./markdown-subset.mjs";
import * as roadClientFunctions from "./road-client.mjs";
import { named, renderLegend } from "./road-key.mjs";
import { dayOf } from "./road-model.mjs";
import { closeSaid, issueRef, issueTitleLink, longDate, READY_TO_CLOSE_LINK, renderGroups, shownSummaryOf } from "./road-progress.mjs";
import { roadIcon } from "./road-icon.mjs";
import { ROAD_STYLE } from "./road-style.mjs";
import * as tabsClientFunctions from "./tabs-client.mjs";

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

// ------------------------------------------------------------------ the road

// A version's row: its number, its state (closed and its close date, or where an open one stands), as HTML, and its
// name.
const versionRow = (m, state) => `<tr><td class="num">${esc(m.version)}</td><td class="num">${state}</td><td>${inline(m.name || m.description)}</td></tr>`;

// A closed version's state: "released on" from v1 on, "closed on" before, and its close date, when it has one.
const closedState = (m) => esc(closeSaid(m.marker, dayOf(m.closedAt)));

// Where an open version stands: planned, or ready to close; the current one's linked to the bar, whose line says who
// closes it.
function openState(m) {
  if (!m.readyToClose) return "planned";
  return m.current ? READY_TO_CLOSE_LINK : "ready to close";
}

function renderVersionsTable(road) {
  const ms = road.milestones;
  const rows = [
    ...ms.closed.map((m) => versionRow(m, closedState(m))),
    ...ms.open.map((m) => versionRow(m, openState(m))),
  ];
  if (!rows.length) return "";
  return `<h2>Versions</h2><div class="scroll"><table><tr><th>Version</th><th>State</th><th>What it can do</th></tr>${rows.join("")}</table></div>`;
}

// The bets table, under a line saying what it holds.
function renderBets(road) {
  if (!road.bets.length) return "";
  const rows = road.bets.map((b) => `<tr><td>${issueTitleLink(b.issue)}</td><td>${inline(b.bet)}</td><td class="num">${esc(b.version || "no milestone yet")}</td></tr>`).join("");
  const says = `<p class="s">What each open issue rests on: what must be true for it to be worth building. Where is its version, or no milestone yet.</p>`;
  return `<h2>Bets the road rests on</h2>${says}<div class="scroll"><table><tr><th>Issue</th><th>The bet</th><th>Where</th></tr>${rows}</table></div>`;
}

// what each flag says after its issue's number
const FLAG_WORDS = {
  "family": (f) => `carries ${f.labels.length} state labels of one family: ${f.labels.join(", ")}`,
  "closed-active": () => "is closed and still labelled active",
  "silent-real-use": (f) => `checks ${f.version}, ${closeSaid(f.marker, f.closed)}, and names nothing it waits on`,
};

// The waiting issues late past the threshold, in one strip, the longest waiting first, each number linked with its
// days; none late, none.
function lateStrip(waiting) {
  const late = waiting.open.filter((i) => i.late);
  if (!late.length) return "";
  const said = late.map((i) => `${issueRef(i)} (${esc(plural(i.age, "day"))})`).join(", ");
  return `<p class="flag">Waiting on you for more than ${esc(plural(waiting.lateAfterDays, "day"))}: ${said}</p>`;
}

function renderFlags(road) {
  return lateStrip(road.waiting) + road.flags.map((f) => `<p class="flag">${issueRef(f.issue)} ${esc(FLAG_WORDS[f.kind](f))}</p>`).join("");
}

// A filter of the road model's, a counter's or the bar's, as the tracker's issue search; `sort` its order, or none.
function issueSearch(f, sort) {
  const terms = ["is:issue"];
  if (f.state) terms.push(`is:${f.state}`);
  for (const l of f.labelsIn || []) terms.push(`label:${l}`);
  if (f.milestone === false) terms.push("no:milestone");
  else if (f.milestone) terms.push(`milestone:"${f.milestone}"`);
  for (const l of f.labelsOut || []) terms.push(`-label:${l}`);
  if (f.parent === false) terms.push("no:parent-issue");
  if (sort) terms.push(sort);
  return `issues?q=${encodeURIComponent(terms.join(" "))}`;
}

// The real-green counter's card: the last issue closed real-green named, and how many more closed that day; `l` its
// label as text, `labelHtml` as HTML, the issue's number linked.
function realGreenCard(realGreen, view) {
  const label = (ref) => {
    const named = `${ref}${realGreen.more ? ` and ${realGreen.more} more` : ""} went real-green`;
    return realGreen.days === 0 ? named : `since ${named} on ${longDate(realGreen.date)}`;
  };
  const n = realGreen.days === 0 ? "today" : plural(realGreen.days, "day");
  return { n, l: label(`#${realGreen.issue.number}`), labelHtml: label(issueRef(realGreen.issue)), view };
}

// The last version's card: "last version", then, on a line of its own, its marker's word, released or closed, and its
// close date, when it has one; `l` its label as text, `labelHtml` as HTML.
function lastVersionCard(last) {
  const markerAndDate = last.closed ? closeSaid(last.marker, last.closed) : "";
  return {
    n: last.version, l: `last version${markerAndDate ? `, ${markerAndDate}` : ""}`,
    labelHtml: `last version${markerAndDate ? `<br>${esc(markerAndDate)}` : ""}`, view: "milestones?state=closed",
  };
}

// The counters as cards, in order, each with what its number counts, zero said in words, and `view`, the tracker's
// page listing it.
function kpiCards(counters) {
  const { lastVersion, realGreen, filters } = counters;
  const cards = [];
  if (lastVersion) cards.push(lastVersionCard(lastVersion));
  // the search has no close-date sort
  if (realGreen) cards.push(realGreenCard(realGreen, issueSearch(filters.realGreen, "sort:updated-desc")));
  cards.push({ n: countInWords(counters.waiting, "nothing"), l: "waiting on you", view: issueSearch(filters.waiting) });
  const placed = counters.candidates ? { n: `${counters.candidates}`, l: "with no milestone yet" } : { n: "all", l: "on a milestone" };
  cards.push({ ...placed, view: issueSearch(filters.candidates) });
  return cards;
}

function renderKpis(road) {
  const url = road.tracker.url;
  // a link's name holds its words and says which of the four it is
  const source = (c) => (url ? `<a href="${esc(`${url}/${c.view}`)}" rel="noopener"${named(`${c.l} on the tracker`)}>the tracker</a>` : "the tracker");
  return `<div class="kpis">${kpiCards(road.counters).map((c) => `<div class="kpi"><div class="n">${esc(c.n)}</div><div class="l">${c.labelHtml || esc(c.l)}</div><div class="s">${source(c)}</div></div>`).join("")}</div>`;
}

// The real-use issues still open on a milestone ready to close, said after what closing is: closing does not wait for
// them, and they stay in Now; none, nothing said.
function openUsesSaid(uses) {
  if (!uses.length) return "";
  const numbers = uses.map(issueRef).join(", ");
  const after = uses.length === 1
    ? "closing does not wait for it, and it stays in Now until it is real-green"
    : "closing does not wait for them, and they stay in Now until they are real-green";
  return ` ${plural(uses.length, "real-use check is", "real-use checks are")} still open (${numbers}): ${after}.`;
}

// What closing the current milestone is, said when it is ready to close: who does what, and what closing writes; then
// the real-use issues still open on it. Its source is the slice skill's close, skills/slice/SKILL.md, "When the
// milestone's last slice lands": a change there changes this sentence.
const readyLine = (m, uses) => `<p class="ready">Ready to close, on your word: Claude walks the product as a newcomer and reviews the code's structure, you pick what becomes an issue, then it closes ${esc(m.version)}, writes the release notes and places the waiting issues on milestones.${openUsesSaid(uses)}</p>`;

// The bar under the line: the slices' track, filled to its share done, then, past a gap, the release's tenth drawn as
// a planned milestone's marker, the word "release" under it.
const meterOf = (filled) => `<div class="meter" aria-hidden="true"><div class="track">${filled === null ? "" : `<div class="fill" style="width: ${filled}%"></div>`}</div><div class="release"></div></div><p class="release-word" aria-hidden="true">release</p>`;

// The current milestone's bar, under the counters, none with no milestone open: one line of its version and name,
// linked to its issues on the tracker, then its slices done of all, "then the release", or "no slices yet"; under it
// the bar; then, ready to close, the line saying what closing is. Ready to close, the part holds the "ready to close"
// links' anchor: they land with the part centred in the window, the bar and the line in view together.
function renderBar(road) {
  const p = road.progress;
  if (!p) return "";
  const m = p.milestone, url = road.tracker.url;
  const view = p.link.filter ? issueSearch(p.link.filter) : `milestone/${p.link.milestone}`;
  const heading = url ? `<a href="${esc(`${url}/${view}`)}" rel="noopener"${named(`${m.heading}, its issues on the tracker`)}>${esc(m.heading)}</a>` : esc(m.heading);
  const said = m.slices ? `${countInWords(m.slicesDone, "none")} of ${plural(m.slices, "slice")} done, then the release` : "no slices yet";
  const anchor = m.readyToClose ? `<span id="ready-to-close"></span>` : "";
  return `<div class="progress">${anchor}<p class="t">${heading} <span class="count">· ${said}</span></p>${meterOf(p.filled)}${m.readyToClose ? readyLine(m, p.realUsesOpen) : ""}</div>`;
}

// Where the page's data came from, said first. `read` is how the tracker was read; `road` null means no snapshot.
function trackerLine(read, road) {
  const s = road && road.tracker;
  const when = s && s.fetched ? `${longDate(dayOf(s.fetched))} ${s.fetched.slice(11, 16)} UTC` : "an unknown date";
  const repo = s && s.repo ? (s.url ? `<a href="${esc(s.url)}/issues" rel="noopener">${esc(s.repo)}</a>` : esc(s.repo)) : "the tracker";
  if (read.live) return `<p class="s">Read from ${repo} on ${when}.</p>`;
  if (s && !read.error) return `<p class="s">Drawn offline from the snapshot of ${repo}, ${when}.</p>`;
  if (s) return `<p class="unread">The tracker could not be read (${esc(read.error)}); drawn from the snapshot of ${when}.</p>`;
  return `<p class="unread">The tracker could not be read${read.error ? ` (${esc(read.error)})` : ""}, and there is no snapshot at ${esc(read.snapshotPath)}: the road is empty.</p>`;
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

// What an orange card is, said under the read line while a card is drawn: one waiting past the threshold, `days`.
const orangeLine = (days) => `<p class="s">An orange card has waited on you for more than ${esc(plural(days, "day"))}.</p>`;

// Where an answer to a card goes, said under the orange line while a card is drawn.
const answerLine = (url) => `<p class="s">To answer one, click its number to open the issue on ${esc(trackerName(url))}, and write your answer there as a comment.</p>`;

function renderYou(view) {
  const road = view.road;
  const out = [trackerLine(view.read, road)];
  if (!road) return out.join("\n");
  if (road.waiting.open.length) out.push(orangeLine(road.waiting.lateAfterDays), answerLine(road.tracker.url));
  // the tab's heading for a screen reader, so its cards' h3 skip no level under the page's h1; the nav shows its name
  out.push(`<h2 class="unseen">Waiting on you</h2>`);
  const card = (i) => {
    const age = i.age === null ? "" : `<p class="s">${i.age === 0 ? "waiting since today" : `waiting for ${plural(i.age, "day")}`}</p>`;
    return `<div class="card${i.late ? " late" : ""}"><h3>${issueTitleLink(i)}</h3>${age}${markdownSubset(i.body, 4)}</div>`;
  };
  const { open, answered } = road.waiting;
  if (!open.length) out.push(`<p>Nothing is waiting on you.</p>`);
  out.push(open.map(card).join(""));
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

// The page's lead, under its title: the one-pager's first paragraph, taken as an issue's Summary is, drawn inline;
// none with no one-pager read, or no paragraph in it.
function leadOf(onePager) {
  const summary = shownSummaryOf(onePager);
  return summary ? `<p class="lead">${inline(summary)}</p>` : "";
}

// One tab's link, `count` what waits on it: with something waiting, a badge, and a name saying the count apart from
// its words.
const tabLink = ([id, label, count]) => (count
  ? `<a href="#${id}" aria-label="${esc(label)}, ${count} waiting">${esc(label)}<span class="badge">${count}</span></a>`
  : `<a href="#${id}">${esc(label)}</a>`);

// The page. `view`: { road, read: { live, error, snapshotPath }, architecture, onePager, tokens, structure,
// projectName, linkBase }, where `onePager` is the one-pager's text, null when unread, `tokens` is the token file,
// { path, css }, `css` null when unread, and `structure` the Architecture tab's part the structure module drew at this
// size step ({ atop, html, css, js, leftOut }), or null with no structure declared.
// `sizeStep`, the attempt's: { index, past the first said; detail, whether "more" opens an issue's detail }.
export function roadHtml(view, sizeStep) {
  const name = view.projectName;
  const src = (text) => srcLink(view.linkBase, text);
  const waiting = view.road ? view.road.counters.waiting : 0;
  const tabs = [["road", "Progress", 0], ["you", "Waiting on you", waiting]];
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
