// @level presentation
// Roadkeeper — the test sweep's page: one self-contained HTML file, no script, one card per card given, in their order,
// each its test file and cases, kind, reason, proposed change, coverage line and what was not read for coverage, then,
// once per test file, the lines only several of its cards together reached. Every text from the cards is escaped where
// it is rendered; the reason comes cut to its cap (cards-file.mjs).

import { plural } from "../../_text.mjs";
import { escapeHtml } from "../../_words.mjs";
import { formatReach } from "./format-reach.mjs";

const NOTHING_ALONE = "No line of the project's code only these cases reached."; // a card whose cases reached nothing alone
// the lead's sentence after the count: what to do with the cards
const PICK = "Read each card, then tell Claude the numbers of the cards to act on: a card proposes deleting its cases, or moving them to their module's entry.";
// the lead's last sentence when some card was read for coverage
const COVERAGE_SAID = "Its coverage line names the project's code only its cases reached in the whole suite: deleting them loses those lines' only test.";
const NONE_READ = "No card was read for coverage: each card's Not read line says why."; // the lead's last, with none read
const SHARED_HEADING = "Reached only by several cards together"; // over each file's lines its cards together reached
// under that heading: what deleting those cards together loses
const SHARED_SAID = "Each line here is reached only by the carded cases of its test file, by no one card alone: deleting all of that file's cards loses the line's only test.";
// the page's colours, light, then dark when the reader's system asks for it
const STYLE = `:root { --page: #f6f6f3; --card: #ffffff; --ink: #1c1c1a; --muted: #5e5e58; --rule: #dcdcd5; --tag: #e9e8e0;
  --lost: #7a3411; --none: #2d6a39; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --page: #151514; --card: #1e1e1c; --ink: #ebebe6; --muted: #a3a39b;
  --rule: #34342f; --tag: #2c2c28; --lost: #f0a77c; --none: #8fd19c; } }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2.section { font-size: 17px; margin: 28px 0 4px; }
.lead, .note { color: var(--muted); margin: 0 0 20px; }
.cards { display: grid; gap: 12px; }
.card, .shared { background: var(--card); border: 1px solid var(--rule); border-radius: 8px; padding: 14px 16px; }
.card h2 { font-size: 13px; font-weight: 600; color: var(--muted); margin: 0 0 8px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
dt { color: var(--muted); }
dd { margin: 0; overflow-wrap: anywhere; }
code { font: 13px/1.5 ui-monospace, "Cascadia Mono", Menlo, monospace; }
.kind { background: var(--tag); border-radius: 999px; padding: 1px 8px; }
.lost { color: var(--lost); }
.none { color: var(--none); }
.unread { color: var(--lost); font-style: italic; }
@media (max-width: 560px) { dl { grid-template-columns: 1fr; } dt { margin-top: 6px; } }`;

// A reach as a description: its lines in code, else NOTHING_ALONE.
const coverageHtml = (reach) => (reach.size
  ? `<dd class="lost"><code>${escapeHtml(formatReach(reach))}</code></dd>`
  : `<dd class="none">${escapeHtml(NOTHING_ALONE)}</dd>`);

// What a card says was not read: a sentence as it is; a coverage reader's folder that could not be listed,
// { language, unlisted }, its `language` code not read, and why.
const buildNotReadLine = (unread) => (typeof unread === "string" ? unread
  : `Its ${unread.language} code was not read for coverage: the run's coverage folder could not be listed (${unread.unlisted}).`);

// A card's coverage rows: its own lines, then each of what was not read; no lines row when nothing was read (`alone`
// null).
function coverageRows({ alone, unread }) {
  const own = alone ? `<dt>Coverage</dt>${coverageHtml(alone)}` : "";
  return own + unread.map((said) => `<dt>Not read</dt><dd class="unread">${escapeHtml(buildNotReadLine(said))}</dd>`).join("");
}

// One test file's lines only several of its cards together reached, as an <article>: sweep-runs.mjs's { file, lines }.
const sharedHtml = ({ file, lines }) => `<article class="shared"><dl>
<dt>File</dt><dd><code>${escapeHtml(file)}</code></dd>
<dt>Coverage</dt><dd class="lost"><code>${escapeHtml(formatReach(lines))}</code></dd>
</dl></article>`;

// The section of every file's lines only several cards together reached; "" when there are none.
const sharedSection = (shared) => (shared.length
  ? `<h2 class="section">${SHARED_HEADING}</h2>\n<p class="note">${SHARED_SAID}</p>\n<div class="cards">\n${shared.map(sharedHtml).join("\n")}\n</div>` : "");

// The lead: the cards counted, what to do with them, then what their coverage lines say, or that none was read.
const leadOf = (cards, coverage) => `${plural(cards.length, "card")}. ${PICK} ${coverage.some((c) => c.alone) ? COVERAGE_SAID : NONE_READ}`;

// One card as an <article>: `card` cards-file.mjs's, `coverage` sweep-runs.mjs's { alone, unread }.
function cardHtml(card, coverage) {
  const cases = card.cases.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ");
  return `<article class="card"><h2>Card ${card.number}</h2><dl>
<dt>Case</dt><dd><code>${escapeHtml(card.file)}</code>: ${cases}</dd>
<dt>Kind</dt><dd><span class="kind">${escapeHtml(card.kind)}</span></dd>
<dt>Reason</dt><dd>${escapeHtml(card.reason)}</dd>
<dt>Change</dt><dd>${escapeHtml(card.change)}</dd>
${coverageRows(coverage)}
</dl></article>`;
}

// The page's HTML for the cards and their coverage, in the same order, then each file's lines only several of its
// cards together reached (`shared`, sweep-runs.mjs's).
export function drawCardsPage(cards, coverage, shared) {
  const articles = cards.map((card, k) => cardHtml(card, coverage[k])).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test sweep</title><style>${STYLE}</style></head>
<body><main>
<h1>Test sweep</h1>
<p class="lead">${escapeHtml(leadOf(cards, coverage))}</p>
<div class="cards">
${articles}
</div>
${sharedSection(shared)}
</main></body></html>
`;
}
