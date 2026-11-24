// @level domain
// Roadkeeper — the test sweep's cards file, the contract between the test-reader agents and the sweep command: its
// format's one home, the fields, kinds and caps below, which the command's --help prints (cards-format.mjs), and the
// file checked against it. A model's output, so every field is held to its shape and cap before it is kept. Refuses
// the first card breaking the format, with what it must be; a reason is kept cut to REASON_CAP, never refused for its
// length.

import { cutAt } from "../../_text.mjs";

// the five kinds a card's case is judged by, as the test-reader names them
export const CARD_KINDS = ["repeat", "inside detail", "checked from the side", "tautological", "unneeded"];
export const INSIDE_DETAIL = "inside detail"; // the one kind whose card may propose a move to the entry
export const DELETE = "delete"; // a card's proposed change: its cases deleted
export const MOVE = "move to the entry"; // a card's proposed change: its cases moved to the module's entry
const FIELDS = ["file", "cases", "kind", "reason", "change"]; // a card's fields, all of them, in the format's order
export const MAX_CARDS = 500; // cards in one file: a suite of thousands of cases, a few in ten carded, with room
export const MAX_CASES = 100; // cases on one card: a repeat across a test file's cases, with room
export const ID_CAP = 500; // characters of a case id: a long JS/TS describe chain joined by " > "
export const PATH_CAP = 260; // characters of a test file's path: Windows' classic path length
export const REASON_CAP = 1000; // characters of a reason the page shows: a paragraph

const isText = (v, cap) => typeof v === "string" && v.length > 0 && v.length <= cap;
const isPlainObject = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const hasFieldsOnly = (o) => isPlainObject(o) && Object.keys(o).length === FIELDS.length && FIELDS.every((f) => Object.hasOwn(o, f));
const isCaseList = (v) => Array.isArray(v) && v.length > 0 && v.length <= MAX_CASES && v.every((id) => isText(id, ID_CAP))
  && new Set(v).size === v.length;

// What a card breaks, the first in the format's order: the words saying what it must be, or null.
function cardFault(card) {
  if (!hasFieldsOnly(card)) return `its fields must be ${FIELDS.join(", ")}, each once`;
  if (!isText(card.file, PATH_CAP)) return `its file must be a test file's path from the root, at most ${PATH_CAP} characters`;
  if (!isCaseList(card.cases)) return `its cases must be 1 to ${MAX_CASES} case ids, each named once`;
  if (!CARD_KINDS.includes(card.kind)) return `its kind must be one of ${CARD_KINDS.join(", ")}`;
  if (typeof card.reason !== "string" || !card.reason.trim()) return "its reason must be text";
  if (card.change !== DELETE && card.change !== MOVE) return `its change must be ${DELETE} or ${MOVE}`;
  const isMoveOfOtherKind = card.change === MOVE && card.kind !== INSIDE_DETAIL;
  if (isMoveOfOtherKind) return `only an ${INSIDE_DETAIL} proposes a ${MOVE}; a ${card.kind} proposes ${DELETE}`;
  return null;
}

// The first case of these cards named on an earlier card of the same file: { number, at, earlier } or null.
function findRepeatedCase(cards) {
  const seen = new Map();
  for (const card of cards) {
    for (const [k, id] of card.cases.entries()) {
      const key = `${card.file}\n${id}`;
      if (seen.has(key)) return { number: card.number, at: k + 1, earlier: seen.get(key) };
      seen.set(key, card.number);
    }
  }
  return null;
}

// The cards file's text read against the format: { cards }, each { number, file, cases, kind, reason, change }, its
// number its place from 1, its reason cut to REASON_CAP; or { fault: { card, what } }, `card` the number of the card at
// fault, null for the file as a whole, `what` the words saying what it must be.
export function readCards(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { fault: { card: null, what: "it is not JSON" } }; }
  if (!Array.isArray(parsed)) return { fault: { card: null, what: "it is not an array" } };
  if (!parsed.length || parsed.length > MAX_CARDS) return { fault: { card: null, what: `it must hold 1 to ${MAX_CARDS} cards` } };
  for (const [k, card] of parsed.entries()) {
    const what = cardFault(card);
    if (what) return { fault: { card: k + 1, what } };
  }
  const cards = parsed.map((c, k) => ({ number: k + 1, file: c.file, cases: [...c.cases], kind: c.kind,
    reason: cutAt(c.reason, REASON_CAP), change: c.change }));
  const repeated = findRepeatedCase(cards);
  if (repeated) return { fault: { card: repeated.number, what: `its case ${repeated.at} is on card ${repeated.earlier} too: a case goes on one card` } };
  return { cards };
}
