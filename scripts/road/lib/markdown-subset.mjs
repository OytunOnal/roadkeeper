// @level presentation
// Roadkeeper — the Markdown subset The Road draws issue text and ARCHITECTURE.md with, as HTML. Deterministic, no library.
//
// Five exports: markdownSubset(text, headingLevel) for blocks, inline(text, { links }) for one line, and for an
// issue's Summary as its card shows it, withLfEndings(text), listItems(lines, from) and cutInline(text, n). The text is
// a stranger's: all of it is escaped, a link keeps to the allow-listed schemes, and a mermaid fence loses its click
// lines, said.

import { cutAt, esc, fenceStep } from "../../_text.mjs";

const MERMAID_KINDS = /^(flowchart|graph|stateDiagram(-v2)?|sequenceDiagram|classDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|block-beta|sankey-beta|xychart-beta|C4Context)\b/;

// one inline span: code, bold, italic (two forms), a link, a bare URL; inline() draws them, cutInline() keeps them whole
const INLINE_SPAN = /(`+)([\s\S]*?)\1|\*\*([^*\n]+)\*\*|(?:^|(?<=[\s(]))_([^_\n]+)_|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>\]]+)/g;

// Inline: code, bold, italic, links, bare URLs. Everything else is literal, escaped text. With `links` false, a link
// and a bare URL stay text, its label or the URL: for text inside a link of its own, where a link would nest.
export function inline(src, { links = true } = {}) {
  const text = String(src == null ? "" : src);
  const re = new RegExp(INLINE_SPAN);
  let out = "", last = 0, m;
  while ((m = re.exec(text)) !== null) {
    out += esc(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[2] !== undefined) out += `<code>${esc(m[2])}</code>`;
    else if (m[3] !== undefined) out += `<strong>${esc(m[3])}</strong>`;
    else if (m[4] !== undefined) out += `<em>${esc(m[4])}</em>`;
    else if (m[5] !== undefined) out += `<em>${esc(m[5])}</em>`;
    else if (m[6] !== undefined) out += links ? link(m[7], m[6]) : esc(m[6]);
    else if (m[8] !== undefined) {
      const url = trimBareUrl(m[8]);
      out += links ? link(url, url) : esc(url);
      last = re.lastIndex = m.index + url.length; // what the link left is read again as text
    }
  }
  return out + esc(text.slice(last));
}

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
  if (!/^(https?:\/\/|mailto:|\.{0,2}\/|#)/i.test(h)) return esc(label); // anything else stays literal text
  return `<a href="${esc(h)}" rel="noopener">${esc(label)}</a>`;
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
    if (MERMAID_KINDS.test(first)) return `<pre class="mermaid">${esc(body)}</pre>${clickNote(removed)}`;
    return `<p class="note">This mermaid block does not start with a diagram kind, so it is shown as text.</p>\n<pre class="code"><code>${esc(body)}</code></pre>${clickNote(removed)}`;
  }
  return `<pre class="code"><code>${esc(raw)}</code></pre>`;
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
export const withLfEndings = (text) => String(text || "").replace(/\r\n?/g, "\n");

// The text's blocks, in order: each drawn HTML, but a heading, { depth, html }, its `#` count and its text drawn, and a
// quote, { quote }, its own blocks.
function parsedBlocks(text) {
  const lines = withLfEndings(text).split("\n");
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const block = fenceBlock(lines, i);
    if (block) {
      flush();
      i = block.next;
      out.push(block.html);
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      out.push({ depth: h[1].length, html: inline(h[2].replace(/\s*#+\s*$/, "")) });
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (/^\s*\|/.test(line)) {
      flush();
      const block = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
      i--;
      out.push(mdTable(block));
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const block = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) block.push(lines[i++].replace(/^\s*>\s?/, ""));
      i--;
      out.push({ quote: parsedBlocks(block.join("\n")) });
      continue;
    }
    const li = LIST_ITEM.exec(line);
    if (li) {
      flush();
      const list = mdList(lines, i);
      i = list.next;
      out.push(list.html);
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out;
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

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

// The list starting at line `from`: its items, each without its marker, an indented line folded into the item above,
// and `next`, the first line past it, as an unindented line that starts no item ends it. Null when line `from` starts
// no item.
export function listItems(lines, from = 0) {
  if (!LIST_ITEM.test(lines[from] || "")) return null;
  const items = [];
  let i = from;
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]);
    if (m) items.push(m[3]);
    else if (/^\s+\S/.test(lines[i])) items[items.length - 1] += " " + lines[i].trim();
    else break;
    i++;
  }
  return { items, next: i };
}

// The list starting at `from`, drawn, and the index of its last line.
function mdList(lines, from) {
  const ordered = /\d/.test(LIST_ITEM.exec(lines[from])[2]);
  const { items, next } = listItems(lines, from);
  const tag = ordered ? "ol" : "ul";
  const box = (t) => t.replace(/^\[([ xX])\]\s*/, (_, c) => (c === " " ? "☐ " : "☑ "));
  return { next: next - 1, html: `<${tag}>` + items.map((t) => `<li>${inline(box(t))}</li>`).join("") + `</${tag}>` };
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
