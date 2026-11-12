// @level domain
// Roadkeeper — the review points: a point's kind, two points' order, whether a point is due, and the versions a tracker
// snapshot shows closed.

import { versionOf } from "../../_text.mjs";

// The review point (GLOSSARY: Review point): a day, `YYYY-MM-DD`, or a version, `vX.Y.Z`, as the reader took it. The
// check decides by these alone; the Architecture tab's page embeds reviewPointKind and reviewPointOrder by their source.
//
// reviewPointKind: 'day' or 'version', by the point's shape.
export function reviewPointKind(p) {
  return /^[vV]/.test(p) ? 'version' : 'day';
}
// reviewPointOrder: below 0 when `a` comes first, 0 when the two are one point, above 0 when `b` does; versions part
// by part (v0.9 before v0.10), days as written; null for a day against a version, which never sort together.
export function reviewPointOrder(a, b) {
  var kind = reviewPointKind(a);
  if (kind !== reviewPointKind(b)) return null;
  if (kind === 'day') { if (a === b) return 0; return a < b ? -1 : 1; }
  var x = a.slice(1).split('.'), y = b.slice(1).split('.');
  for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (Number(x[i]) || 0) - (Number(y[i]) || 0); if (d) return d; }
  return 0;
}
// reviewPointDue: a day is due on it or after, given today; a version once it or a later one is in `closed`, the
// versions closed on the tracker (or the one a stamp is about to write).
export function reviewPointDue(p, today, closed) {
  if (reviewPointKind(p) === 'day') return Boolean(today) && reviewPointOrder(p, today) <= 0;
  for (var i = 0; i < closed.length; i++) { var o = reviewPointOrder(closed[i], p); if (o !== null && o >= 0) return true; }
  return false;
}
// the versions a tracker snapshot shows closed: its closed milestones' titles that open on a version
export const closedVersions = (snap) => snap.milestones.filter((m) => m.state === "closed").map((m) => versionOf(m.title)).filter(Boolean);
