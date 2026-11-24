// @level presentation
// Roadkeeper — the Markdown subset The Road draws issue text and ARCHITECTURE.md with, as HTML. Deterministic, no library.
//
// Two exports: markdownSubset(text, headingLevel) for blocks, inline(text, { links }) for one line; the reading of
// headings, lists and inline spans is The Road's (../../lib/markdown-reading.mjs). The text is a stranger's: all
// of it is escaped, a link keeps to the allow-listed schemes, and a mermaid fence loses its click lines, said.

import { fenceStep } from "../../../_text.mjs";
import { escapeHtml } from "../../../_words.mjs";
import { HEADING_LINE, INLINE_SPAN, LIST_ITEM, readListEntries } from "../../lib/markdown-reading.mjs";

// the diagram kinds mermaid draws: a mermaid fence whose first line names none is shown as text
const MERMAID_KINDS =/^(flowchart|graph|stateDiagram(-v2)?|sequenceDiagram|classDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|block-beta|sankey-beta|xychart-beta|C4Context)\b/;

// Inline: code, bold, italic, links, bare URLs. Everything else is literal, escaped text. With `links` false, a link
// and a bare URL stay text, its label or the URL: for text inside a link of its own, where a link would nest.
export function inline(src, { links = true } = {}) {
  const text = String(src == null ? "" : src);
  const re = new RegExp(INLINE_SPAN);
  let out = "", last = 0, m;
  while ((m = re.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[2] !== undefined) out += `<code>${escapeHtml(m[2])}</code>`;
    else if (m[3] !== undefined) out += `<strong>${escapeHtml(m[3])}</strong>`;
    else if (m[4] !== undefined) out += `<em>${escapeHtml(m[4])}</em>`;
    else if (m[5] !== undefined) out += `<em>${escapeHtml(m[5])}</em>`;
    else if (m[6] !== undefined) out += links ? link(m[7], m[6]) : escapeHtml(m[6]);
    else if (m[8] !== undefined) {
      const url = trimBareUrl(m[8]);
      out += links ? link(url, url) : escapeHtml(url);
      last = re.lastIndex = m.index + url.length; // what the link left is read again as text
    }
  }
  return out + escapeHtml(text.slice(last));
}

// A bare URL ends as GitHub's autolinks do: trailing punctuation and quotes stay outside it, and a trailing `)`
// too when the URL holds more `)` than `(`.
function trimBareUrl(url) {
  let end = url.length;
  let open = 0, close = 0;
  for (const c of url) { if (c === "(") open++; else if (c === ")") close++; }
  while (end > 0) {
    const c = url[end - 1];
    if (`.,:;!?*_~"'`.includes(c)) end--;
    else if (c === ")" && close > open) { end--; close--; }
    else break;
  }
  return url.slice(0, end);
}

function link(href, label) {
  const h = String(href || "");
  if (!/^(https?:\/\/|mailto:|\.{0,2}\/|#)/i.test(h)) return escapeHtml(label); // anything else stays literal text
  return `<a href="${escapeHtml(h)}" rel="noopener">${escapeHtml(label)}</a>`;
}

// A mermaid `click` directive makes a node open a URL or call a function in the viewer's page.
// A diagram is a picture here, so every click line is dropped before the block is emitted, in
// both modes, and the page says how many were dropped.
function stripClickLines(body) {
  const lines = String(body).split("\n");
  const kept = lines.filter((l) => !/^\s*click\b/i.test(l));
  return { body: kept.join("\n"), removed: lines.length - kept.length };
}

function clickNote(removed) {
  if (!removed) return "";
  return `\n<p class="note">${removed} click line${removed === 1 ? "" : "s"} removed: a diagram on this page is a picture, not a link.</p>`;
}

function fence(lang, raw) {
  if (/^mermaid$/i.test(lang || "")) {
    const { body, removed } = stripClickLines(raw);
    const first = body.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("%%")) || "";
    if (MERMAID_KINDS.test(first)) return `<pre class="mermaid">${escapeHtml(body)}</pre>${clickNote(removed)}`;
    return `<p class="note">This mermaid block does not start with a diagram kind, so it is shown as text.</p>\n<pre class="code"><code>${escapeHtml(body)}</code></pre>${clickNote(removed)}`;
  }
  return `<pre class="code"><code>${escapeHtml(raw)}</code></pre>`;
}

// The fence opening at line `from`, read as the plan reads fences, on the trimmed line; the language is the info
// string's first word. A fence never closed runs to the end of the text. Null when the line opens none.
function fenceBlock(lines, from) {
  const open = fenceStep(null, lines[from].trim()).fence;
  if (!open) return null;
  const body = [];
  let i = from + 1;
  for (let at = open; i < lines.length; i++) {
    at = fenceStep(at, lines[i].trim()).fence;
    if (!at) break;
    body.push(lines[i]);
  }
  return { next: i, html: fence(open.info.split(/\s+/)[0], body.join("\n")) };
}

// Blocks: headings, paragraphs, lists, tables, fences, quotes, rules; a heading's `#` drawn at `headingLevel`, the
// heading levels the text uses mapped in order to consecutive levels from there, capped at h6: `##` then `####` draw
// h4 then h5 from 4, so the page skips no level.
export function markdownSubset(text, headingLevel) {
  const blocks = parsedBlocks(text);
  const depths = [...new Set(headingDepths(blocks))].sort((a, b) => a - b);
  return drawnBlocks(blocks, (depth) => Math.min(6, headingLevel + depths.indexOf(depth)));
}

// The text with each line ended by LF: a CRLF or a lone CR ends a line, as CommonMark has it; GitHub's web editor saves
// a body with CRLF.
const withLfEndings = (text) => String(text || "").replace(/\r\n?/g, "\n");

// The text's blocks, in order: each drawn HTML, but a heading, { depth, html }, its `#` count and its text drawn, and a
// quote, { quote }, its own blocks.
function parsedBlocks(text) {
  const lines = withLfEndings(text).split("\n");
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const read = readBlockAt(lines, i);
    if (!read) { para.push(lines[i].trim()); continue; }
    flush();
    if (read.block !== null) out.push(read.block);
    i = read.last;
  }
  flush();
  return out;
}

// The block starting at line `i`, parsedBlocks' shape, and the index of its last line: { block, last }, block null
// for a blank line, which ends a paragraph; null when the line is a paragraph's.
function readBlockAt(lines, i) {
  const line = lines[i];
  const fenced = fenceBlock(lines, i);
  if (fenced) return { block: fenced.html, last: fenced.next };
  if (/^\s*$/.test(line)) return { block: null, last: i };
  const h = HEADING_LINE.exec(line);
  if (h) return { block: { depth: h[1].length, html: inline(h[2].replace(/\s*#+\s*$/, "")) }, last: i };
  if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) return { block: "<hr>", last: i };
  if (/^\s*\|/.test(line)) {
    const rows = linesWhile(lines, i, /^\s*\|/);
    return { block: mdTable(rows), last: i + rows.length - 1 };
  }
  if (/^\s*>/.test(line)) {
    const quoted = linesWhile(lines, i, /^\s*>/);
    return { block: { quote: parsedBlocks(quoted.map((l) => l.replace(/^\s*>\s?/, "")).join("\n")) }, last: i + quoted.length - 1 };
  }
  if (LIST_ITEM.exec(line)) {
    const list = mdList(lines, i);
    return { block: list.html, last: list.next };
  }
  return null;
}

// the run of lines from `from` that each match `pattern`
function linesWhile(lines, from, pattern) {
  let i = from;
  while (i < lines.length && pattern.test(lines[i])) i++;
  return lines.slice(from, i);
}

// every heading's `#` count in the blocks, a quote's included
function headingDepths(blocks) {
  return blocks.flatMap((b) => {
    if (b.quote) return headingDepths(b.quote);
    return b.depth ? [b.depth] : [];
  });
}

// The blocks as HTML, a heading at the level `levelOf` gives its `#` count.
function drawnBlocks(blocks, levelOf) {
  return blocks.map((b) => {
    if (typeof b === "string") return b;
    if (b.quote) return `<blockquote>${drawnBlocks(b.quote, levelOf)}</blockquote>`;
    const lvl = levelOf(b.depth);
    return `<h${lvl}>${b.html}</h${lvl}>`;
  }).join("\n");
}

// The list starting at `from`, drawn, its items nested by indentation, and the index of its last line. An entry
// indented less than the list's first ends it; the next list starts there.
function mdList(lines, from) {
  const { entries, next } = readListEntries(lines, from);
  let html = "";
  for (let at = 0; at < entries.length;) {
    const list = drawNestedList(entries, at);
    html += list.html;
    at = list.next;
  }
  return { next: next - 1, html };
}

// The list of entries from `at` drawn at the first one's indentation, ordered as its marker says and numbered from its
// number: an entry indented past it goes inside the item above, a list at any depth or a paragraph, and the list goes
// on past it; an item indented less, an item of the other kind or a paragraph it does not hold ends it. `next` is the
// entry past it.
function drawNestedList(entries, at) {
  const { indent, ordered, start } = entries[at];
  const box = (t) => t.replace(/^\[([ xX])\]\s*/, (_, c) => (c === " " ? "☐ " : "☑ "));
  const sibling = (e) => !e.para && e.indent >= indent && e.ordered === ordered;
  let items = "", i = at;
  while (i < entries.length && sibling(entries[i])) {
    let item = inline(box(entries[i++].text));
    while (i < entries.length && entries[i].indent > indent) {
      const inner = entries[i].para ? { html: `<p>${inline(entries[i].text)}</p>`, next: i + 1 } : drawNestedList(entries, i);
      item += inner.html;
      i = inner.next;
    }
    items += `<li>${item}</li>`;
  }
  if (!ordered) return { next: i, html: `<ul>${items}</ul>` };
  return { next: i, html: `<ol${start === 1 ? "" : ` start="${start}"`}>${items}</ol>` };
}

// a table row's cells, with `\|` read as a pipe inside a cell; null for a line that is no row
function splitRow(line) {
  const t = String(line == null ? "" : line).trim();
  if (!t.startsWith("|")) return null;
  let inner = t.slice(1);
  if (/\|$/.test(inner) && !/\\\|$/.test(inner)) inner = inner.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "\\" && inner[i + 1] === "|") { cur += "|"; i++; continue; }
    if (inner[i] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += inner[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparatorRow = (cells) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));

function mdTable(block) {
  const rows = block.map(splitRow).filter(Boolean);
  if (!rows.length) return "";
  const head = rows[0];
  const bodyStart = rows[1] && isSeparatorRow(rows[1]) ? 2 : 1;
  const body = rows.slice(bodyStart).filter((r) => !isSeparatorRow(r));
  const th = `<tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>`;
  const tr = body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
  return `<div class="scroll"><table>${th}${tr}</table></div>`;
}
