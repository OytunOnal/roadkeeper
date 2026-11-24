// @level kernel
// Roadkeeper — the shapes a parsed JSON value is held to before its fields are kept: a plain object, and a path from
// the root that stays inside it.

// Whether a parsed value is a plain object: not null, not an array.
export const isObject = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

// Whether a path from the root, its parts joined by `/`, stays inside it: no part empty, `.` or `..`, no `\` or `:`.
export const isPathFromRoot = (p) => p.split("/").every((part) => part !== "" && part !== "." && part !== ".." && !/[\\:]/.test(part));
