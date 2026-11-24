// @level domain
// Roadkeeper — the reading of an issue's body, the one place The Road reads one: the paragraph its Summary is made
// from, the bet it rests on and the line it names what it waits on with; and the one-pager read as a body is, for the
// page's lead and the project's name. How the road shows a Summary is shown-summary.mjs's. Every reading splits a text
// into lines one way, as CommonMark ends them, a leading byte-order mark dropped (readerLines). Plain text in, plain
// text out, nothing drawn; the text is a stranger's, read as data and cut to a cap.

import { cutAt, readerLines } from "../../_text.mjs";
import { HEADING_LINE } from "./markdown-reading.mjs";

// A stranger's text is cut to a cap (ROADKEEPER_STANDARDS.md, Security): an issue's summary, weighed or shown, stops at
// SUMMARY_AT UTF-16 units.
export const SUMMARY_AT = 600;

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
export function firstParagraph(text) {
  for (const p of paragraphsOf(text)) {
    const lines = p.split("\n").filter((l) => !HEADING_LINE.test(l));
    if (lines.join("").trim() && !WAITS_ON.test(lines.join("\n"))) return lines;
  }
  return [];
}

// The lines a Summary is made from: a body's first paragraph, a spec's under its Problem Statement.
export const readSummaryParagraph = (body) => firstParagraph(readSummarySource(body));

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
