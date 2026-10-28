// @level domain
// Roadkeeper — the bounds on a source file the structure command reads, its size and its nesting, and the two stops naming
// the file that passes one; every language's reader takes them from here.

import { printable } from "./structure-model.mjs";

// a source file's size bound, before it is read: hand-written ones are a few hundred KB
export const SOURCE_MAX_BYTES = 1024 * 1024;
// a source file's nesting bound, as its tree is walked: hand-written ones nest a few tens of levels
export const SOURCE_MAX_NESTING = 256;

// the stop for a file over SOURCE_MAX_BYTES, before any reader opens it
export const sizeStop = (file) => ({ stop: `${printable(file)} is not read: it is over ${SOURCE_MAX_BYTES / 1024 / 1024} MB, the bound on a source file` });

// the stop for a file whose tree a walk follows past SOURCE_MAX_NESTING
export const nestingStop = (file) => ({ stop: `${printable(file)} is not read: it nests past ${SOURCE_MAX_NESTING} levels, the bound on a source file` });
