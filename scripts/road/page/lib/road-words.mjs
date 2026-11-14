// @level presentation
// Roadkeeper — the words The Road's page says in more than one of its parts: the page's one date format, a closed
// version's state, an issue's number linked, an issue's "#N title" linked, "ready to close" linked to its line, an
// element's name, and the Waiting on you tab's id and name.
//
// Tracker text is a stranger's: every title is escaped.

import { dateParts, esc, isCalendarDate } from "../../../_text.mjs";
import { inline } from "./markdown-subset.mjs";

// the months as the page's one date format names them, January first
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

// "ready to close", linked to the bar's part, whose line says who closes the current milestone
export const READY_TO_CLOSE_LINK = `<a href="#ready-to-close">ready to close</a>`;

// An element's name, to a screen reader and on hover.
export const named = (name) => ` aria-label="${esc(name)}" title="${esc(name)}"`;

// The Waiting on you tab: its id, which its link and its section name, and its name on the nav.
export const YOU_TAB = Object.freeze({ id: "you", name: "Waiting on you" });

// A link to issue `i`, which has a URL, holding `inner`, with the class `cls` when one is given.
const issueAnchor = (i, inner, cls) => `<a${cls ? ` class="${cls}"` : ""} href="${esc(i.url)}" rel="noopener">${inner}</a>`;

export const issueRef = (i) => (i.url ? issueAnchor(i, `#${i.number}`) : `#${i.number}`);

// An issue named "#N title", one link to it: a screen reader hears one link; the number keeps the link's look, the
// title its own colour. A link in the title stays text, as one cannot nest in another.
export const issueTitleLink = (i) => (i.url
  ? issueAnchor(i, `<span class="number">#${i.number}</span> <span class="title">${inline(i.title, { links: false })}</span>`, "issue")
  : `${issueRef(i)} ${inline(i.title)}`);
