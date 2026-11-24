// @level infrastructure
// Roadkeeper — the lines of one script V8's block coverage reached, read from V8's ranges: a line counts only when
// every character on it ran.

const WHITE_SPACE = /\s/; // a character that reaches nothing on its own: a line of it alone is never reached

// The ranges of V8's `functions` that lie in a text of `length`, outer first: a range starts at or after the one before
// it, and of two starting together the longer comes first.
const orderedRanges = (functions, length) => functions
  .flatMap((f) => (Array.isArray(f?.ranges) ? f.ranges : []))
  .filter((r) => Number.isSafeInteger(r?.startOffset) && Number.isSafeInteger(r?.endOffset) && r.startOffset >= 0
    && r.startOffset < r.endOffset && r.endOffset <= length)
  .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);

// The 1-based numbers of the lines of `text` the coverage reached whole: each holding a character other than white
// space, every such character's innermost range counted above 0, so a line run only in part is not reached. Ranges
// nest, so they are laid outer first, an inner one over the outer's count. `functions`: V8's, each { ranges:
// [{ startOffset, endOffset, count }] }, offsets in UTF-16 units of the text.
export function reachedLines(text, functions) {
  const counted = new Uint8Array(text.length);
  for (const r of orderedRanges(functions, text.length)) counted.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset);
  const lines = new Set();
  let [line, hasText, allCounted] = [1, false, true];
  for (let k = 0; k <= text.length; k++) {
    if (k === text.length || text[k] === "\n") {
      if (hasText && allCounted) lines.add(line);
      [line, hasText, allCounted] = [line + 1, false, true];
    } else if (!WHITE_SPACE.test(text[k])) {
      hasText = true;
      allCounted &&= counted[k] === 1;
    }
  }
  return lines;
}
