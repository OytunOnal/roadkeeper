// @level presentation
// Roadkeeper — The Road's progress groups: Done, Now, Next and Ahead along the rail, drawn from the road model
// (road-model.mjs), with no decisions of its own; and the seven helpers the page shares with them, the page's one date
// format, a closed version's state, an issue's number linked, an issue's "#N title" linked, "ready to close" linked to
// its line, an issue's Summary as the road shows it, which the page's lead takes from the
// one-pager too, and the project's name as the one-pager says it.
//
// renderGroups(road, sizeStep) draws the four groups: Done, a group per closed milestone and then the issues closed
// with no milestone; Now, the work in flight; Next, the rest of the current milestone; Ahead, a group per later
// milestone and then the issues with no milestone yet. `sizeStep` says whether "more" opens an issue's detail.
//
// Tracker text is a stranger's: every title and body is escaped.

import { countInWords, cutAt, dateParts, esc, isCalendarDate, plural } from "../../_text.mjs";
import { cutInline, inline, listItems, markdownSubset, withLfEndings } from "./markdown-subset.mjs";
import { closedLookOf, lookOf, lookWords, marker } from "./road-key.mjs";
import { WAITS_ON, dayOf } from "./road-model.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The page's one date format: `7 Sep 2026` for a day the calendar has; the text itself for a date-shaped string that is
// not a day; "" for anything else. Dates inside quoted tracker text stay as written.
export function longDate(iso) {
  const p = dateParts(iso);
  if (!p) return "";
  return isCalendarDate(iso) ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : String(iso);
}

// A closed version's state: its marker's word, released or closed, and "on" its close day, `day` (YYYY-MM-DD); the
// word alone with no day.
export const closeSaid = (markerWord, day) => (day ? `${markerWord} on ${longDate(day)}` : markerWord);

// ------------------------------------------------------------------ the road

// Past MORE_AT characters an issue's summary shows two lines and a "more" control opens the rest.
const MORE_AT = 140;

// a marker's line: its version and `noteHtml`, its state's word as HTML
const stamp = (plan, version, noteHtml) => `<li class="stamp${plan ? " plan" : ""}"><div class="when"></div>${marker("bar", plan ? "stamp plan" : "stamp")}<div class="v">${esc(version)}${noteHtml ? ` <small>${noteHtml}</small>` : ""}</div></li>`;

// "ready to close", linked to the bar's part, whose line says who closes the current milestone
export const READY_TO_CLOSE_LINK = `<a href="#ready-to-close">ready to close</a>`;

const tag = (cls, label) => `<span class="tag${cls ? " " + cls : ""}">${esc(label)}</span>`;

// A stranger's text is cut to a cap (ROADKEEPER_STANDARDS.md, Security): an issue's summary, weighed or shown, stops at
// SUMMARY_AT UTF-16 units.
const SUMMARY_AT = 600;

// The lead of an idea's first item, which the idea's title says (skills/idea/SKILL.md, Refine it).
const IDEA_LEAD = /^\**What becomes possible\**:/;

// The lines of the first paragraph of a body that is not a heading's, nor the line naming what it waits on, which its
// waiting chip says; none when there is none.
function firstParagraph(body) {
  for (const p of withLfEndings(body).split(/\n\s*\n/)) {
    const lines = p.split("\n").filter((l) => !/^\s*#/.test(l));
    if (lines.join("").trim() && !WAITS_ON.test(lines.join("\n"))) return lines;
  }
  return [];
}

const oneLine = (parts) => parts.join(" ").replace(/\s+/g, " ").trim();

// An issue's summary, what "more" is weighed against: its first paragraph on one line.
const summaryOf = (body) => cutAt(oneLine(firstParagraph(body)), SUMMARY_AT);

// An issue's Summary as the road shows it: its first paragraph on one line; a list's items as prose, one after
// another, the item led by "What becomes possible:" left out unless no other is left, then the lines past the list.
// Its cut splits no markup.
export function shownSummaryOf(body) {
  const lines = firstParagraph(body);
  const list = listItems(lines);
  if (!list) return cutInline(oneLine(lines), SUMMARY_AT);
  const kept = list.items.filter((t) => !IDEA_LEAD.test(t.trim()));
  return cutInline(oneLine([...(kept.length ? kept : list.items), ...lines.slice(list.next)]), SUMMARY_AT);
}

// The project's name as its one-pager says it: the words of the heading the text opens on, cut as a Summary is; ""
// with no text, or a text opening on anything but a heading.
export function onePagerName(text) {
  const first = withLfEndings(text || "").replace(/^\ufeff/, "").split("\n").find((l) => l.trim());
  const m = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(first || "");
  return m ? cutAt(m[1].replace(/\s+/g, " ").trim(), SUMMARY_AT) : "";
}

// A link to issue `i`, which has a URL, holding `inner`, with the class `cls` when one is given.
const issueAnchor = (i, inner, cls) => `<a${cls ? ` class="${cls}"` : ""} href="${esc(i.url)}" rel="noopener">${inner}</a>`;

export const issueRef = (i) => (i.url ? issueAnchor(i, `#${i.number}`) : `#${i.number}`);

// An issue named "#N title", one link to it: a screen reader hears one link; the number keeps the link's look, the
// title its own colour. A link in the title stays text, as one cannot nest in another.
export const issueTitleLink = (i) => (i.url
  ? issueAnchor(i, `<span class="number">#${i.number}</span> <span class="title">${inline(i.title, { links: false })}</span>`, "issue")
  : `${issueRef(i)} ${inline(i.title)}`);

// What "more" opens: the whole body, a spec's tickets and the comments. Empty when there is nothing past the summary,
// or when the size step leaves detail out (the last attempt).
function issueDetail(i, sizeStep) {
  if (!sizeStep.detail) return "";
  const summary = summaryOf(i.body);
  const rest = String(i.body || "").replace(/\s+/g, " ").trim().length > summary.length;
  if (!rest && !i.comments.length && !i.tickets.length && summary.length <= MORE_AT) return "";
  const tickets = i.tickets.map((t) => `<li>${issueRef(t)} ${inline(t.title)}</li>`).join("");
  const comments = i.comments.map((c) => `<div class="comment"><p class="s">${esc(c.author || "someone")}${c.createdAt ? ` · ${esc(longDate(dayOf(c.createdAt)))}` : ""}</p>${markdownSubset(c.body, 5)}</div>`).join("");
  return `<div class="full">${markdownSubset(i.body, 4)}${tickets ? `<h4 class="part">Tickets</h4><ul>${tickets}</ul>` : ""}${comments ? `<h4 class="part">Comments</h4>${comments}` : ""}</div>`;
}

// A spec's tickets and how many are merged, while one is open: "1 ticket, none merged yet", "3 tickets, 1 merged".
const mergedOf = (i) => (i.ticketsClosed < i.tickets.length
  ? `<span class="n merged">${plural(i.tickets.length, "ticket")}, ${i.ticketsClosed ? `${i.ticketsClosed} merged` : "none merged yet"}</span>`
  : "");

// The chips naming an issue's linked issues: the issues specced in it, "specced from #N", and its real uses, open or
// closed, "real-use check #N", each linked.
const refChips = (i) => [["specced from", i.from], ["real-use check", i.realUses]].filter(([, refs]) => refs.length)
  .map(([word, refs]) => `<span class="tag ref">${word} ${refs.map(issueRef).join(", ")}</span>`).join("");

// Characters a waiting chip's words keep before their cut: at 1440 px the heading column holds 87 of a chip's.
const WAITS_CHIP_AT = 80;

// Cut a string past n UTF-16 units at its last whole word before the nth, as cutAt cuts it, the punctuation and space
// after that word dropped and "…" added, so the cut holds n units at most; a word longer than that is cut inside it.
// The string itself when it fits.
function cutAtWord(s, n) {
  if (s.length <= n) return s;
  const cut = cutAt(s, n - 1);
  const end = /\s/.test(s.charAt(cut.length)) ? cut.length : cut.search(/\s\S*$/);
  return `${(end > 0 ? cut.slice(0, end) : cut).replace(/[\s,;:]+$/, "")}…`;
}

// `text` escaped, each `#N` of `refs` (an issue's number and address) linked, any other `#N` left text.
const withRefs = (text, refs) => text.split(/(#\d{1,9}\b)/).map((part, at) => {
  const ref = at % 2 ? refs.find((r) => `#${r.number}` === part) : null;
  return ref ? issueRef(ref) : esc(part);
}).join("");

// The chip saying what an issue in flight waits on, beside its board chip: "waits on your word" in the waiting colours
// while it wears waiting-on-you; else "waits on" and its line, its issues linked, cut at a word past WAITS_CHIP_AT.
// A cut chip shows its whole words on hover; a screen reader reads them whole, from hidden text, and not the cut. Its
// links stay in the cut it shows, the one Tab reaches, so a keyboard's focus is seen; none when it waits on nothing named.
function waitsChip(i) {
  if (i.waitsOnYou) return `<span class="tag wait">waits on your word</span>`;
  if (!i.waitsOn) return "";
  const words = `waits on ${i.waitsOn.line}`, cut = cutAtWord(words, WAITS_CHIP_AT);
  if (cut === words) return `<span class="tag">${withRefs(words, i.waitsOn.refs)}</span>`;
  return `<span class="tag" title="${esc(words)}"><span aria-hidden="true">${withRefs(cut, i.waitsOn.refs)}</span><span class="unseen">${esc(words)}</span></span>`;
}

// An issue's heading: its h3 names the issue alone, "#N title", one link; what sits beside it follows on its line, in a
// sibling. The space between them, in its own span, is the line's one break there: a line too short moves the chips
// down, never the title's last word with them; beside a word it spaces the chips from it, and at a line's start it
// collapses, so chips alone start at the title's edge.
function issueHeading(i, beside) {
  return `<div class="heading"><h3>${issueTitleLink(i)}</h3>${beside ? `<span class="gap"> </span><span class="beside">${beside}</span>` : ""}</div>`;
}

// One issue on the rail; `look` is its slice class, the look its marker is named by when not that class's
// (`markerLook`), what its when column says as HTML (`whenHtml`), its state tag, and whether it tags its version
// (`tagsVersion`). Its "more" names its issue to a screen reader, its visible word
// first; it sits in the less bar at the card's foot, where an open card's "less" sticks.
function issueSlice(i, look, sizeStep) {
  const summary = shownSummaryOf(i.body);
  const detail = issueDetail(i, sizeStep);
  const text = (summary ? `<p class="sum${detail ? " clamp" : ""}">${inline(summary)}</p>` : "")
    + (detail ? `${detail}<div class="less-bar"><button type="button" class="more" aria-expanded="false" aria-label="more about #${i.number}">more</button></div>` : "");
  const version = look.tagsVersion && i.version ? tag("ver", i.version) : "";
  const beside = `${refChips(i)}${look.tag}${waitsChip(i)}${version}${mergedOf(i)}`;
  return `<li class="slice${look.cls ? " " + look.cls : ""}"><div class="when">${look.whenHtml}</div>${marker("dot", look.markerLook || look.cls, Boolean(i.version))}<div class="body">${issueHeading(i, beside)}${text}</div></li>`;
}

// One issue on the rail, drawn by its board label, its state's word a tag; `tagsVersion` true where milestones mix, as
// in Now: inside a milestone's group its heading names the version. A closed issue's when column says "closed on" on
// a line above its close date; an open one's is empty. A closed issue still mock-green, its real use open, is drawn as
// an open one is; any other closed issue but a real-green one is shut: with no real-use check, its chip "closed
// without real-use check"; with one, that check's chip alone, its marker "closed".
function issueNode(i, sizeStep, tagsVersion) {
  const closed = i.state === "CLOSED";
  const whenHtml = closed && i.closedAt ? `closed on<br>${esc(longDate(dayOf(i.closedAt)))}` : "";
  const b = closed ? closedLookOf(i.board) : lookOf(i.board);
  if (closed && !b) {
    const shut = i.realUses.length ? { markerLook: "closed", tag: "" } : { tag: tag("", lookWords("shut")) };
    return issueSlice(i, { ...shut, cls: "shut", whenHtml, tagsVersion }, sizeStep);
  }
  return issueSlice(i, b ? { cls: b.look, whenHtml, tag: tag(b.swatch, b.words), tagsVersion } : { cls: "cand", whenHtml, tag: "", tagsVersion }, sizeStep);
}

// A milestone's stamp: its version and its marker's word, a closed one's with its close day, or `noteHtml` in its
// place; its group's heading carries its name.
const milestoneStamp = (m, noteHtml = esc(closeSaid(m.marker, dayOf(m.closedAt)))) => stamp(m.state !== "closed", m.version, noteHtml);

// A row saying a group holds nothing: its words on the rail, no marker, which would read as an issue.
const emptyRail = (text) => `<li class="slice"><div class="when"></div><div></div><div class="body"><h3>${esc(text)}</h3></div></li>`;

// One group: `head` its id, its title, its count and whether it starts open; `inner` what it holds past its heading.
const groupBox = (head, inner) => `<details class="group" id="${esc(head.id)}"${head.open === false ? "" : " open"}><summary><span class="t">${esc(head.title)}</span><span class="n">${esc(head.count)}</span></summary>${inner}</details>`;

// One group on the rail: its drawn list.
const groupOf = (head, nodes) => groupBox(head, `<ol class="rail">${nodes}</ol>`);

// One of Done's groups: a closed milestone's, headed by its version and name, its close date and its slices, its
// issues then its stamp. It starts collapsed.
function groupInDone(g, sizeStep) {
  const m = g.milestone;
  const head = { id: `done-${m.version}`, title: m.heading, count: `${m.closedAt ? `${closeSaid(m.marker, dayOf(m.closedAt))} · ` : ""}${countInWords(m.slices, "no slices", "slice")}`, open: false };
  return groupOf(head, g.issues.map((i) => issueNode(i, sizeStep)).join("") + milestoneStamp(m));
}

// Done's last group: the issues closed with no milestone, collapsed; none when there are none.
const noMilestoneInDone = (issues, sizeStep) => (issues.length
  ? groupOf({ id: "done-no-milestone", title: "closed with no milestone", count: plural(issues.length, "issue"), open: false }, issues.map((i) => issueNode(i, sizeStep)).join(""))
  : "");

// Done starts collapsed: the present comes first.
function renderDoneGroup(road, sizeStep) {
  const done = road.done;
  const head = { id: "done", title: "Done", count: `${countInWords(done.issues, "no issues", "issue")} closed · ${countInWords(done.milestones, "no milestones", "milestone")} closed`, open: false };
  const groups = done.groups.map((g) => groupInDone(g, sizeStep)).join("") + noMilestoneInDone(done.noMilestone, sizeStep);
  return groups ? groupBox(head, groups) : groupOf(head, emptyRail("Nothing closed yet"));
}

// Now: the work in flight, each issue on a milestone tagged with its version.
function renderNowGroup(road, sizeStep) {
  const now = road.now;
  return groupOf({ id: "now", title: "Now", count: `${countInWords(now.inFlight, "none")} in flight` }, now.issues.map((i) => issueNode(i, sizeStep, true)).join("") || emptyRail("Nothing in flight"));
}

// Next — vX — <name>, or "Next — vX · ready to close" once it is: the current milestone's issues not in flight, closed
// first, then queued, then its stamp, saying "ready to close" too, linked to the bar and its line; with none, a row
// saying its issues are all in Now, or that it has none yet.
function renderNextGroup(road, sizeStep) {
  const { milestone: m, issues, inFlight } = road.next;
  if (!m) return groupOf({ id: "next", title: "Next", count: "no open milestone" }, emptyRail("No open milestone"));
  const empty = emptyRail(inFlight ? "All in flight: its issues are in Now." : "No issues on it yet.");
  const rows = issues.length ? issues.map((i) => issueNode(i, sizeStep)).join("") : empty;
  const nextStamp = m.readyToClose ? milestoneStamp(m, READY_TO_CLOSE_LINK) : milestoneStamp(m);
  const title = m.readyToClose ? `Next — ${m.version} · ready to close` : `Next — ${m.heading}`;
  return groupOf({ id: "next", title, count: countInWords(m.slices, "no slices", "slice") }, rows + nextStamp);
}

// One of Ahead's groups: a later milestone's, headed by its version, its name and its slices, its issues then its
// stamp. It starts open as the model draws it.
function groupInAhead(a, sizeStep) {
  const m = a.milestone;
  const head = { id: `ahead-${m.version}`, title: m.heading, count: countInWords(m.slices, "no slices", "slice"), open: a.open };
  return groupOf(head, a.issues.map((i) => issueNode(i, sizeStep)).join("") + milestoneStamp(m));
}

// Ahead: a group per later milestone, then the issues with no milestone yet under their divider, each "not placed".
function renderAheadGroup(road, sizeStep) {
  const ahead = road.ahead;
  const head = { id: "ahead", title: "Ahead", count: `${countInWords(ahead.count, "no issues", "issue")} on later milestones · ${countInWords(ahead.later.length, "none")} with no milestone yet` };
  const groups = ahead.milestones.map((a) => groupInAhead(a, sizeStep)).join("");
  const later = ahead.later.length
    ? `<ol class="rail"><li class="divider"><div class="when"></div><div></div><div class="t">No milestone yet</div></li>${ahead.later.map((i) => issueSlice(i, { cls: "cand", whenHtml: "not placed", tag: "" }, sizeStep)).join("")}</ol>`
    : "";
  if (!groups && !later) return groupOf(head, emptyRail("Nothing planned beyond the open milestone"));
  return groupBox(head, groups + later);
}

// The four groups along the rail, in order: Done, Now, Next, Ahead.
export function renderGroups(road, sizeStep) {
  return [renderDoneGroup(road, sizeStep), renderNowGroup(road, sizeStep), renderNextGroup(road, sizeStep), renderAheadGroup(road, sizeStep)].join("\n");
}
