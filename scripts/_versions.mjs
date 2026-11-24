// @level domain
// Roadkeeper — a milestone's version: the token a title opens with, its numbers, and their order.

export const VERSION_TOKEN = /^v\d+(?:\.\d+)*$/i; // a version as a milestone's title and an exception's review point write it

// a version token's numbers, part by part: `v2.2` → [2, 2]
export const versionNumbers = (v) => v.slice(1).split(".").map(Number);

// two version tokens, compared part by part: v0.10 is after v0.9
export function compareVersions(a, b) {
  const x = versionNumbers(a), y = versionNumbers(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}

// the version a milestone's title opens with (`v2.0 — Roadkeeper runs on the tracker` → `v2.0`), or null
export const versionOf = (title) => { const m = /^\s*(v\d+(?:\.\d+)*)/i.exec(title || ""); return m ? m[1] : null; };
