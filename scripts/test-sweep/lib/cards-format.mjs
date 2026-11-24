// @level presentation
// Roadkeeper — the cards file's format as the sweep command's --help prints it, written from the fields, kinds and caps
// the cards file is checked against (cards-file.mjs, the format's one home).

import {
  CARD_KINDS, DELETE, ID_CAP, INSIDE_DETAIL, MAX_CARDS, MAX_CASES, MOVE, PATH_CAP, REASON_CAP,
} from "./cards-file.mjs";

const quoted = (words) => words.map((w) => `"${w}"`).join(", "); // a list as the format says it

// the cards file's format as --help prints it, each field in the format's order
export const CARDS_FORMAT = `The cards file: one JSON array of 1 to ${MAX_CARDS} cards, each an object of exactly these fields:
  "file"    the test file, its path from the root with "/", at most ${PATH_CAP} characters
  "cases"   1 to ${MAX_CASES} of its cases, each by its id as the project tools read it from the run's report, at most
            ${ID_CAP} characters: JS/TS, the describe names and its own name joined by " > "; Python, as pytest names it
            past the file; a case on one card only
  "kind"    one of ${quoted(CARD_KINDS)}
  "reason"  why, in words, naming the seam and, for a repeat, the case it repeats; the page shows its first
            ${REASON_CAP.toLocaleString("en")} characters
  "change"  "${DELETE}", or "${MOVE}" for an ${INSIDE_DETAIL}
A card: {"file": "tests/math.test.ts", "cases": ["adds zero"], "kind": "repeat", "reason": "adds checks the same sum at the same entry", "change": "delete"}`;
