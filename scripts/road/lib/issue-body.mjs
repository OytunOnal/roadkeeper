// @level domain
// Roadkeeper — the reading of an issue's body, the one place The Road reads one: its Summary as the road shows it, the
// summary "more" is weighed against, the bet it rests on and the line it names what it waits on with; and the one-pager
// read as a body is, for the page's lead and the project's name. Every reading splits a text into lines one way, as
// CommonMark ends them, a leading byte-order mark dropped (readerLines). Plain text in, plain text out, nothing drawn;
// the text is a stranger's, read as data and cut to a cap.

import { cutAt, readerLines } from "../../_text.mjs";
import { HEADING_LINE, cutInline, listItems } from "./markdown-reading.mjs";

// A stranger's text is cut to a cap (ROADKEEPER_STANDARDS.md, Security): an issue's summary, weighed or shown, stops at
// SUMMARY_AT UTF-16 units.
const SUMMARY_AT = 600;

// The lead of an idea's first item, which the idea's title says (skills/idea/SKILL.md, Refine it).
const IDEA_LEAD = /^\**What becomes possible\**:/;

const BET_SCAN = 2000; // characters of a body scanned for its bet

// the lead of the paragraph a real-use issue names what it waits on with (skills/slice/SKILL.md, step 10, Later use)
const WAITS_ON = /^\s*\*\*Waits on:\*\*[ \t]*/i;

// A text on one line: each run of white space, line ends included, one space, the ends trimmed.
export const onOneLine = (text) => String(text).replace(/\s+/g, " ").trim();

// A text's paragraphs, in order: its lines as readerLines splits them, parted at each blank line.
const paragraphsOf = (text) => readerLines(text).join("\n").split(/\n\s*\n/);

// The text a Summary is read from: a spec's, what follows its `## Problem Statement` heading, which /to-spec writes;
// any other body whole.
function readSummarySource(body) {
  const lines = readerLines(body);
  const at = lines.findIndex((l) => {
    const h = HEADING_LINE.exec(l);
    return h && h[1] === "##" && h[2].trim() === "Problem Statement";
  });
  if (at < 0) return lines.join("\n");
  return lines.slice(at + 1).join("\n");
}

// The lines of the first paragraph of a text that is not a heading's, nor the line naming what it waits on, which its
// waiting chip says; none when there is none.
function firstParagraph(text) {
  for (const p of paragraphsOf(text)) {
    const lines = p.split("\n").filter((l) => !HEADING_LINE.test(l));
    if (lines.join("").trim() && !WAITS_ON.test(lines.join("\n"))) return lines;
  }
  return [];
}

// The lines a Summary is made from: a body's first paragraph, a spec's under its Problem Statement.
const readSummaryParagraph = (body) => firstParagraph(readSummarySource(body));

// A line ending on a colon, announcing what it does not show: its last sentence dropped while one comes before it,
// else the colon made a full stop. A sentence ends at `.`, `!` or `?` and a space, so "v2.6.0" ends none.
function dropClosingColon(line) {
  if (!line.endsWith(":")) return line;
  const ends = [...line.matchAll(/[.!?](?= )/g)];
  return ends.length ? line.slice(0, ends[ends.length - 1].index + 1) : `${line.slice(0, -1)}.`;
}

// An issue's summary, what "more" is weighed against: its first paragraph on one line.
export const summaryOf = (body) => cutAt(onOneLine(readSummaryParagraph(body).join(" ")), SUMMARY_AT);

// A paragraph's lines with a list opening them read as prose: its items one after another, the item led by "What
// becomes possible:" left out unless no other is left, then the lines past the list; lines with no list as they are.
function turnListToProse(lines) {
  const list = listItems(lines);
  if (!list) return lines;
  const kept = list.items.filter((t) => !IDEA_LEAD.test(t.trim()));
  return [...(kept.length ? kept : list.items), ...lines.slice(list.next)];
}

// A paragraph's lines as the road shows them: on one line, a list's items as prose; a line ending on a colon ends on a
// sentence. Its cut splits no markup.
const makeShownLine = (lines) => cutInline(dropClosingColon(onOneLine(turnListToProse(lines).join(" "))), SUMMARY_AT);

// An issue's Summary as the road shows it: its first paragraph, a spec's under its Problem Statement, made a shown line.
export const shownSummaryOf =(body) => makeShownLine(readSummaryParagraph(body));

// The page's lead as the road shows it: the one-pager's first paragraph, a Problem Statement heading read as any
// heading, made a shown line as a Summary is.
export const shownLeadOf = (onePager) => makeShownLine(firstParagraph(onePager));

// The project's name as its one-pager says it: the words of the heading the text opens on, cut as a Summary is; ""
// with no text, or a text opening on anything but a heading.
export function onePagerName(text) {
  const first = readerLines(text).find((l) => l.trim());
  const m = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(first || "");
  return m ? cutAt(onOneLine(m[1]), SUMMARY_AT) : "";
}

// The bet an issue rests on: the text after `Bet:` in its body, to the end of that paragraph.
export function betOf(body) {
  const scan = cutAt(readerLines(body).join("\n"), BET_SCAN);
  const m = /\*{0,2}bet\*{0,2}:\*{0,2}[ \t]*/i.exec(scan);
  if (!m) return null;
  const rest = scan.slice(m.index + m[0].length);
  const end = rest.search(/\n\s*\n/);
  return onOneLine(end >= 0 ? rest.slice(0, end) : rest).replace(/[*\s]+$/, "") || null;
}

// The line an issue's body names what it waits on with: its last paragraph after `**Waits on:**`, on one line, its last
// full stop dropped; "" with none.
export function waitsOnLineOf(body) {
  const paragraphs = paragraphsOf(body).filter((p) => p.trim());
  const last = paragraphs[paragraphs.length - 1] || "";
  return WAITS_ON.test(last) ? onOneLine(last.replace(WAITS_ON, "")).replace(/\.$/, "") : "";
}
