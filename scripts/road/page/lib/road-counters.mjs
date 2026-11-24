// @level presentation
// Roadkeeper — the top of The Road's Progress tab: the counters as cards, the current milestone's bar with its line,
// and the flags, the late strip first; drawn from the road model, with no decisions of their own. A counter's card and
// the bar's line link to the tracker's search for what they count, written by the search the page is handed.
//
// Tracker text is a stranger's: every title and label is escaped.

import { plural } from "../../../_text.mjs";
import { countInWords, escapeHtml } from "../../../_words.mjs";
import { labelWaiting } from "../../lib/waiting-words.mjs";
import { YOU_TAB, closeSaid, issueRef, longDate, milestoneHeading, named } from "./road-words.mjs";

// what each flag says after its issue's number: the fault, then the step Claude takes to clear it
const FLAG_WORDS = {
  "family": (f) => `carries ${f.labels.length} state labels of one family: ${f.labels.join(", ")}; Claude keeps the true one and removes the ${f.labels.length === 2 ? "other" : "others"}`,
  "closed-active": () => "is closed and still labelled active; Claude removes the active label at the next slice start",
  "silent-real-use": (f) => `checks ${f.version}, ${closeSaid(f.marker, f.closed)}, and names nothing it waits on; Claude writes the issue's Waits on line, or closes the issue when its check is done`,
  "stale-waits-on": (f) => `waits on "${f.line}", and ${f.version} was ${closeSaid(f.marker, f.closed)}; Claude rewrites the Waits on line to what the issue waits on now`,
};

// The waiting issues late past the threshold, in one strip, the longest waiting first, each number linked with its
// days; none late, none.
function lateStrip(waiting) {
  const late = waiting.open.filter((i) => i.late);
  if (!late.length) return "";
  const said = late.map((i) => `${issueRef(i)} (${escapeHtml(plural(i.age, "day"))})`).join(", ");
  return `<p class="flag">Waiting on you for more than ${escapeHtml(plural(waiting.lateAfterDays, "day"))}: ${said}</p>`;
}

export function renderFlags(road) {
  return lateStrip(road.waiting) + road.flags.map((f) => `<p class="flag">${issueRef(f.issue)} ${escapeHtml(FLAG_WORDS[f.kind](f))}</p>`).join("");
}

// The real-green counter's card: the last issue closed real-green named, and how many more closed that day; `l` its
// label as text, `labelHtml` as HTML, the issue's number linked.
function realGreenCard(realGreen, view) {
  const label = (ref) => {
    const wentGreen = `${ref}${realGreen.more ? ` and ${realGreen.more} more` : ""} went real-green`;
    return realGreen.days === 0 ? wentGreen : `since ${wentGreen} on ${longDate(realGreen.date)}`;
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
    labelHtml: `last version${markerAndDate ? `<br>${escapeHtml(markerAndDate)}` : ""}`, view: "milestones?state=closed",
  };
}

// The counters as cards, in order, each with what its number counts, zero said in words, and `view`, the tracker's
// page listing it, or `tab`, the page's own tab drawing exactly what it counts. `issueSearch(filter, sort)`: a filter as
// the tracker's search, the page's address after the repository's.
function kpiCards(counters, issueSearch) {
  const { lastVersion, realGreen, filters } = counters;
  const cards = [];
  if (lastVersion) cards.push(lastVersionCard(lastVersion));
  // the search has no close-date sort
  if (realGreen) cards.push(realGreenCard(realGreen, issueSearch(filters.realGreen, "sort:updated-desc")));
  cards.push({ n: countInWords(counters.waiting, "nothing"), l: labelWaiting("you"), tab: YOU_TAB });
  const placed = counters.candidates ? { n: `${counters.candidates}`, l: "with no milestone yet" } : { n: "all", l: "on a milestone" };
  cards.push({ ...placed, view: issueSearch(filters.candidates) });
  return cards;
}

// The counters' cards, each linked to the tracker's search (`issueSearch`, kpiCards') or the page's own tab.
export function renderKpis(road, issueSearch) {
  const url = road.tracker.url;
  // a tracker link's name holds its words and says which counter it is; a tab's link names the tab
  const source = (c) => {
    if (c.tab) return `<a href="#${c.tab.id}">the ${escapeHtml(c.tab.name)} tab</a>`;
    return url ? `<a href="${escapeHtml(`${url}/${c.view}`)}" rel="noopener"${named(`${c.l} on the tracker`)}>the tracker</a>` : "the tracker";
  };
  return `<div class="kpis">${kpiCards(road.counters, issueSearch).map((c) => `<div class="kpi"><div class="n">${escapeHtml(c.n)}</div><div class="l">${c.labelHtml || escapeHtml(c.l)}</div><div class="s">${source(c)}</div></div>`).join("")}</div>`;
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
const readyLine = (m, uses) => `<p class="ready">Ready to close, on your word: Claude walks the product as a newcomer, reviews the code's structure and reads the tests for cases that catch nothing, you pick what becomes an issue, then it closes ${escapeHtml(m.version)}, writes the release notes and places the waiting issues on milestones.${openUsesSaid(uses)}</p>`;

// The bar under the line: the slices' track, filled to its share done, then, past a gap, the release's tenth drawn as
// a planned milestone's marker, the word "release" under it.
const meterOf = (filled) => `<div class="meter" aria-hidden="true"><div class="track">${filled === null ? "" : `<div class="fill" style="width: ${filled}%"></div>`}</div><div class="release"></div></div><p class="release-word" aria-hidden="true">release</p>`;

// The current milestone's bar, under the counters, none with no milestone open: one line of its version and name,
// linked to its issues on the tracker, then its slices done of all, "then the release", or "no slices yet"; under it
// the bar; then, ready to close, the line saying what closing is. Ready to close, the part holds the "ready to close"
// links' anchor: they land with the part centred in the window, the bar and the line in view together.
// `issueSearch`: kpiCards'.
export function renderBar(road, issueSearch) {
  const p = road.progress;
  if (!p) return "";
  const m = p.milestone, url = road.tracker.url;
  const view = p.link.filter ? issueSearch(p.link.filter) : `milestone/${p.link.milestone}`;
  const title = milestoneHeading(m);
  const heading = url ? `<a href="${escapeHtml(`${url}/${view}`)}" rel="noopener"${named(`${title}, its issues on the tracker`)}>${escapeHtml(title)}</a>` : escapeHtml(title);
  const said = m.slices ? `${countInWords(m.slicesDone, "none")} of ${plural(m.slices, "slice")} done, then the release` : "no slices yet";
  const anchor = m.readyToClose ? `<span id="ready-to-close"></span>` : "";
  return `<div class="progress">${anchor}<p class="t">${heading} <span class="count">· ${said}</span></p>${meterOf(p.filled)}${m.readyToClose ? readyLine(m, p.realUsesOpen) : ""}</div>`;
}
