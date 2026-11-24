// @level kernel
// Roadkeeper — generic Markdown reading, knowing nothing of the project: a heading's line, a list's entries, and an
// inline span with a cut that keeps it whole. The Road's page draws with it (page/lib/markdown-subset.mjs) and the
// reading of an issue's body reads with it (issue-body.mjs). It draws nothing; the text is a stranger's, read as data.

import { cutAt, fenceStep } from "../../_text.mjs";

// A heading's line: `#` to `######`, then a space or a tab, then its text; a `#` joined to the word after it is text.
export const HEADING_LINE = /^(#{1,6})\s+(.*)$/;

// one inline span: code, bold, italic (two forms), a link, a bare URL; the page's inline() draws them, cutInline() keeps
// them whole
export const INLINE_SPAN = /(`+)([\s\S]*?)\1|\*\*([^*\n]+)\*\*|(?:^|(?<=[\s(]))_([^_\n]+)_|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>\]]+)/g;

// The text cut at n UTF-16 units, as cutAt cuts it, moved back to the start of an inline span the cut would split, so
// no half of its markup is drawn as text.
export function cutInline(src, n) {
  const text = String(src == null ? "" : src);
  const cut = cutAt(text, n);
  if (cut.length === text.length) return text;
  for (const m of text.matchAll(INLINE_SPAN)) {
    if (m.index >= cut.length) break;
    if (m.index + m[0].length > cut.length) return cut.slice(0, m.index).trimEnd();
  }
  return cut;
}

// a list item's line: its indentation, its marker (a bullet, or a number and `.` or `)`), then its text
export const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

// a line of spaces alone is blank, as a paragraph's end is read
const BLANK = /^\s*$/;
const indentOf = (line) => /^\s*/.exec(line)[0].length;

// A line opening a block of its own: a fence, a table row, a quote or a rule.
const opensBlock = (line) => Boolean(fenceStep(null, line.trim()).fence) || /^\s*(\||>|(---|\*\*\*|___)\s*$)/.test(line);

// Whether the list of `entries` goes on at `line`, past a blank line: an item does, and an indented line of text with
// an item indented less above it, which holds it.
const goesOnAfterBlank = (line, entries) => line !== undefined && (LIST_ITEM.test(line)
  || (/^\s+\S/.test(line) && !opensBlock(line) && entries.some((e) => !e.para && e.indent < indentOf(line))));

// The list starting at line `from`: its entries, in order, and `next`, the first line past it. An item is an entry:
// its marker's indentation, whether the marker is a number and the number, and its text without the marker. An
// indented line that starts no item is folded into the entry above; past a blank line it is an entry of its own, a
// paragraph (`para`), held by the item indented less above it. A blank line ends the list unless the list goes on
// after it; an unindented line that starts no item ends it. Null when line `from` starts no item.
export function readListEntries(lines, from) {
  if (!LIST_ITEM.test(lines[from] || "")) return null;
  const entries = [];
  let i = from, afterBlank = false;
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]);
    if (m) entries.push({ indent: m[1].length, ordered: /\d/.test(m[2]), start: parseInt(m[2], 10), text: m[3] });
    else if (BLANK.test(lines[i])) {
      let j = i;
      while (j < lines.length && BLANK.test(lines[j])) j++;
      if (!goesOnAfterBlank(lines[j], entries)) break;
      [i, afterBlank] = [j, true];
      continue;
    } else if (!/^\s+\S/.test(lines[i])) break;
    else if (afterBlank) entries.push({ indent: indentOf(lines[i]), para: true, text: lines[i].trim() });
    else entries[entries.length - 1].text += " " + lines[i].trim();
    [i, afterBlank] = [i + 1, false];
  }
  return { entries, next: i };
}

// The list starting at line `from` as one run of items, an item indented under another among them: each entry's text,
// an item's without its marker, and `next`, the first line past the list. Null when line `from` starts no item.
export function listItems(lines, from = 0) {
  const list = readListEntries(lines, from);
  return list && { items: list.entries.map((e) => e.text), next: list.next };
}
