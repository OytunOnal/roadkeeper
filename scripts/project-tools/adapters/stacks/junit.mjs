// @level domain
// Roadkeeper — the test cases of a JUnit XML text: each <testcase>, with the names of the <testsuite> elements around it,
// its name, classname and file attributes, and its outcome: FAIL with a <failure> or <error> inside, else SKIP with a
// <skipped>, else PASS; a FAIL's detail is its failure's message, else its text. A hand scanner over the text, bounded
// by its length: comments, CDATA outside a failure, processing instructions and declarations are passed over;
// attribute values are decoded of the five named entities and the numeric ones. Reads no tag it cannot parse.

const DETAIL_KEPT = 2000; // characters of a failure's text kept: its message and the first lines of its stack
const NAME = /[A-Za-z_][\w.:-]*/y; // an element's or attribute's name, as JUnit writers spell them
const ATTRIBUTE = /\s+([A-Za-z_][\w.:-]*)\s*=\s*("[^"]*"|'[^']*')/y; // a quoted value may hold ">": Node's runner leaves it
const TAG_END = /\s*(\/?)>/y; // a tag's end, "/" when it is empty
// a markup that is no element: its opening and its end
const PASSED_OVER = [["<!--", "-->"], ["<![CDATA[", "]]>"], ["<?", "?>"], ["<!", ">"]];
const NAMED = new Map([["lt", "<"], ["gt", ">"], ["amp", "&"], ["quot", "\""], ["apos", "'"]]); // XML's five entities
const MAX_CODE_POINT = 0x10ffff; // Unicode's last: a reference past it reads as "?"

const codePoint = (n) => {
  const isCharacter = Number.isInteger(n) && n > 0 && n <= MAX_CODE_POINT;
  return isCharacter ? String.fromCodePoint(n) : "?";
};
const reference = (e) => (e[1] === "x" ? codePoint(parseInt(e.slice(2), 16)) : codePoint(parseInt(e.slice(1), 10)));
const decoded = (s) => s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|lt|gt|amp|quot|apos);/g, (_, e) => (e[0] === "#" ? reference(e) : NAMED.get(e)));

// The element's attributes from `at`, a map with no prototype, and where they end.
function attributesAt(text, at) {
  const attributes = Object.create(null);
  let end = at;
  for (let a; (ATTRIBUTE.lastIndex = end, a = ATTRIBUTE.exec(text)); end = ATTRIBUTE.lastIndex) attributes[a[1]] = decoded(a[2].slice(1, -1));
  return { attributes, end };
}

// The markup at `at`, a "<": { end, cdata } for one passed over, { end, name, close, empty, attributes } for a tag,
// { end } past a "<" that opens neither.
function markupAt(text, at) {
  for (const [opening, closing] of PASSED_OVER) {
    if (!text.startsWith(opening, at)) continue;
    const stop = text.indexOf(closing, at + opening.length);
    const end = stop < 0 ? text.length : stop + closing.length;
    return { end, cdata: opening === "<![CDATA[" ? text.slice(at + opening.length, stop < 0 ? text.length : stop) : null };
  }
  const close = text[at + 1] === "/";
  NAME.lastIndex = at + (close ? 2 : 1);
  const name = NAME.exec(text);
  if (!name) return { end: at + 1 };
  const { attributes, end } = attributesAt(text, NAME.lastIndex);
  TAG_END.lastIndex = end;
  const tail = TAG_END.exec(text);
  return tail ? { end: TAG_END.lastIndex, name: name[0], close, empty: tail[1] === "/", attributes } : { end: at + 1 };
}

// A <testsuite> tag: its name opened or closed around the cases inside it.
function onSuite(state, { close, empty, attributes }) {
  if (empty) return;
  if (close) state.suites.pop();
  else state.suites.push(attributes.name ?? "");
}

// A <testcase> tag: one opened, or one closed and kept.
function onCase(state, { close, empty, attributes }) {
  if (!close) {
    state.open = { suites: [...state.suites], name: attributes.name ?? "", classname: attributes.classname ?? "",
      file: attributes.file ?? "", outcome: "PASS", detail: "", text: "" };
  }
  const ends = close || empty;
  if (ends && state.open) { state.cases.push(state.open); state.open = null; }
}

// A tag inside the open case: a failure or an error fails it, its text read until it closes; a skip skips a passing one.
function onOutcome(state, { name, close, empty, attributes }) {
  const isFailure = name === "failure" || name === "error";
  if (isFailure && !close) { state.open.outcome = "FAIL"; state.open.detail = attributes.message ?? ""; }
  if (isFailure) state.inFailure = !close && !empty;
  const skips = name === "skipped" && !close && state.open.outcome === "PASS";
  if (skips) state.open.outcome = "SKIP";
}

// The reading's state moved by one tag: the suites open, the case open, whether a failure's text is being read.
function onTag(state, tag) {
  if (tag.name === "testsuite") onSuite(state, tag);
  else if (tag.name === "testcase") onCase(state, tag);
  else if (state.open) onOutcome(state, tag);
}

// Text inside a failure, kept toward its detail.
function onText(state, text) {
  const kept = state.inFailure && state.open && state.open.text.length < DETAIL_KEPT;
  if (kept) state.open.text = (state.open.text + text).slice(0, DETAIL_KEPT);
}

// The test cases of the JUnit text, in their order: { suites, name, classname, file, outcome, detail }.
export function junitCases(text) {
  const state = { suites: [], open: null, inFailure: false, cases: [] };
  let at = 0;
  for (let next; (next = text.indexOf("<", at)) >= 0;) {
    if (next > at) onText(state, decoded(text.slice(at, next)));
    const markup = markupAt(text, next);
    if (markup.cdata != null) onText(state, markup.cdata);
    else if (markup.name) onTag(state, markup);
    at = markup.end;
  }
  return state.cases.map(({ text: failureText, ...c }) => ({ ...c, detail: (c.detail || failureText).trim() }));
}
