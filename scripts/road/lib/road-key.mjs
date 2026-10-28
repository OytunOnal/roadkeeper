// @level presentation
// Roadkeeper — The Road's key: each look on the rail and its words, read by the legend, by every marker, which says its
// look's words to a screen reader and on hover, and by the closed chip; and the terms the legend explains. Draws HTML
// from fixed words; it reads no tracker text.

import { esc } from "../../_text.mjs";

// Each look by its class (an issue's slice class, a milestone's stamp class), its swatch's class, the words the key
// prints and what they mean. `board` marks the board's state labels: the words are the label an open issue carries,
// the swatch's class its tag's; `keptClosed` the labels whose look a closed issue keeps. `shut` has no key line: its
// words are its chip's, which say themselves. `closed` names the marker of a shut issue with a real-use check, whose
// chip names that check; no row draws its class.
const KEY = [
  { look: "", swatch: "g", words: "real-green", means: "tried in real use, and it works", board: true, keptClosed: true },
  { look: "mock", swatch: "m", words: "mock-green", means: "merged, not yet tried in real use", board: true, keptClosed: true },
  { look: "now", swatch: "a", words: "active", means: "being built", board: true },
  { look: "shut", words: "closed without real-use check" },
  { look: "closed", words: "closed" },
  { look: "cand", swatch: "c", words: "planned / no milestone yet", means: "on a milestone and not started, or not yet placed on one" },
  { look: "stamp", swatch: "v", words: "milestone, closed or released", means: "a version closed; from v1 on, with its release" },
  { look: "stamp plan", swatch: "v plan", words: "milestone, planned", means: "a version on the tracker, not yet released" },
];

// The words the key explains that no look draws, after the looks.
const TERMS = [
  { words: "slice", means: "one piece of work on a milestone, from its first questions to its real-use check" },
];

// The words of the look `look`: the key's, a marker's name and the shut look's chip.
export const lookWords = (look) => KEY.find((k) => k.look === look).words;

// The look of an open issue's board label, { look, swatch, words }, or null for none.
export const lookOf = (label) => KEY.find((k) => k.board && k.words === label) || null;

// The look a closed issue keeps from its board label, real-green's or mock-green's, or null: it is drawn closed.
export const closedLookOf = (label) => KEY.find((k) => k.keptClosed && k.words === label) || null;

// An element's name, to a screen reader and on hover.
export const named = (name) => ` aria-label="${esc(name)}" title="${esc(name)}"`;

// The word a marker of the look `look` says: its entry's words; where they join two states, the first for an issue on
// a milestone, the second for one without.
function markerWord(look, onMilestone) {
  const words = lookWords(look).split(" / ");
  return words[onMilestone || words.length === 1 ? 0 : 1];
}

// A marker on the rail: the element of class `cls`, an image named by the word of its look.
export const marker = (cls, look, onMilestone) => `<div class="${cls}" role="img"${named(markerWord(look, onMilestone))}></div>`;

// The legend, in a group drawn collapsed that opens on a click; at 560 px and wider, where the browser has
// ::details-content, the style shows it whatever its state. A look with a swatch is a line with it; a term, one
// without.
export function renderLegend() {
  const lines = [
    ...KEY.filter((k) => k.swatch).map((k) => `<span class="${k.swatch}"><b>${k.words}</b> — ${k.means}</span>`),
    ...TERMS.map((t) => `<span><b>${t.words}</b> — ${t.means}</span>`),
  ];
  return `<details class="legend-box"><summary><span class="t">What the colours and words mean</span></summary>
  <div class="legend">
    ${lines.join("\n    ")}
  </div></details>`;
}
