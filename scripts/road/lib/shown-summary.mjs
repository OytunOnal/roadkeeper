// @level presentation
// Roadkeeper — an issue's Summary and the one-pager's lead as The Road shows them, and the summary "more" is weighed
// against: the paragraph issue-body.mjs reads, on one line, a list opening it read as prose, a line ending on a colon
// ending on a sentence, cut to the Summary's cap. Plain text in, plain text out, nothing drawn; the text is a
// stranger's, read as data.

import { cutAt } from "../../_text.mjs";
import { cutInline, listItems } from "./markdown-reading.mjs";
import { SUMMARY_AT, firstParagraph, onOneLine, readSummaryParagraph } from "./issue-body.mjs";

// The lead of an idea's first item, which the idea's title says (skills/idea/SKILL.md, Refine it).
const IDEA_LEAD = /^\**What becomes possible\**:/;

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
