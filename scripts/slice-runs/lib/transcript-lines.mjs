// @level infrastructure
// Roadkeeper — a transcript's entries inside a time window, read line by line from a plain file: a line is parsed only
// when a timestamp it holds falls in the window, and an entry counts only by its own timestamp. A line over the cap
// is never held whole: it is counted as skipped.

import { closeSync, openSync, readSync } from "node:fs";

const CHUNK = 1024 * 1024; // bytes read at a time
export const LINE_BYTES_CAP = 64 * 1024 * 1024; // bytes of one line held: bounds the memory one line takes
const NEWLINE = 0x0a; // the byte ending a transcript's line
const STAMP = Buffer.from('"timestamp":"'); // a timestamp's key as a line spells it
const STAMP_LENGTH = 40; // characters of a timestamp read after its key: an ISO time with milliseconds fits

// Whether a timestamp the line holds, any of them, falls in [from, to): the entry's own may follow a nested one.
function holdsTimeIn(line, window) {
  for (let at = line.indexOf(STAMP); at >= 0; at = line.indexOf(STAMP, at + 1)) {
    const start = at + STAMP.length;
    const text = line.toString("latin1", start, Math.min(line.length, start + STAMP_LENGTH));
    const time = Date.parse(text.split('"')[0]);
    if (time >= window.from && time < window.to) return true;
  }
  return false;
}

// The entry a line holds when its own timestamp falls in the window: { timedEntry, isUnparsed }, timedEntry
// { entry, time } or null, isUnparsed whether a line holding a time in the window is no JSON.
function parseEntryIn(line, window) {
  if (!holdsTimeIn(line, window)) return { timedEntry: null, isUnparsed: false };
  let entry;
  try { entry = JSON.parse(line.toString("utf8")); } catch { return { timedEntry: null, isUnparsed: true }; }
  const time = entry && typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : NaN;
  return { timedEntry: time >= window.from && time < window.to ? { entry, time } : null, isUnparsed: false };
}

// A line's bytes gathered across chunks, up to LINE_BYTES_CAP: past it, its bytes are let go and the line is too long.
class LineGathered {
  constructor() { this.parts = []; this.length = 0; this.isTooLong = false; }

  add(bytes) {
    this.length += bytes.length;
    if (this.length > LINE_BYTES_CAP) { this.parts = []; this.isTooLong = true; } else this.parts.push(Buffer.from(bytes));
  }

  // the line ending with `bytes`, or null when it is too long; a view into `bytes` when nothing came before
  close(bytes) {
    const isTooLong = this.isTooLong || this.length + bytes.length > LINE_BYTES_CAP;
    let line = null;
    if (!isTooLong) line = this.parts.length ? Buffer.concat([...this.parts, bytes]) : bytes;
    this.parts = []; this.length = 0; this.isTooLong = false;
    return line;
  }
}

// Each line of the open file `fd`, as bytes, its newline left out, or null for a line over LINE_BYTES_CAP; a line is valid
// until the next is asked for.
function* readLines(fd) {
  const buffer = Buffer.alloc(CHUNK);
  const gathered = new LineGathered();
  for (let read = readSync(fd, buffer, 0, CHUNK, null); read > 0; read = readSync(fd, buffer, 0, CHUNK, null)) {
    let from = 0;
    for (let end = buffer.indexOf(NEWLINE, 0); end >= 0 && end < read; end = buffer.indexOf(NEWLINE, from)) {
      yield gathered.close(buffer.subarray(from, end));
      from = end + 1;
    }
    gathered.add(buffer.subarray(from, read));
  }
  yield gathered.close(Buffer.alloc(0));
}

// The entries of the transcript at `path` in `window` ({ from, to }, milliseconds), in the file's order, each
// { entry, time }, the count of lines skipped over the cap, and of lines in the window that are no JSON:
// { entries, skipped, unparsed }; { isUnreadable } alone when the file cannot be opened or read.
export function readEntriesIn(path, window) {
  try {
    return readOpenedEntries(path, window);
  } catch {
    return { entries: [], skipped: 0, unparsed: 0, isUnreadable: true };
  }
}

// readEntriesIn's read, a failure to open or read the file thrown
function readOpenedEntries(path, window) {
  const entries = [];
  let skipped = 0;
  let unparsed = 0;
  const fd = openSync(path, "r");
  try {
    for (const line of readLines(fd)) {
      if (line === null) { skipped += 1; continue; }
      const { timedEntry, isUnparsed } = parseEntryIn(line, window);
      if (isUnparsed) unparsed += 1;
      if (timedEntry) entries.push(timedEntry);
    }
  } finally { closeSync(fd); }
  return { entries, skipped, unparsed, isUnreadable: false };
}
