// @level presentation
// Roadkeeper — the lines the version forecast's command prints (scripts/version-forecast.mjs): a forecast
// (scripts/_version-forecast.mjs) and the tracker's rename steps.

import { controlsReplaced, cutAt } from "./_text.mjs";

const SHOWN = 120; // characters of a title printed: enough to know it, short enough for one line
// A stranger's title as printed: made printable, cut at SHOWN.
const shown = (title) => {
  const t = controlsReplaced(title);
  return t.length > SHOWN ? cutAt(t, SHOWN) + "…" : t;
};

// What the command prints of a forecast: a line per open milestone, then one per slice with no kind.
export function forecastLines({ milestones, noKind }) {
  const next = (m) => (m.next === null ? "no version: not renumbered" : shown(m.next));
  return [
    ...milestones.map((m) => `#${m.number}  ${shown(m.title)}  slices ${m.slices}  room ${m.room}  bump ${m.bump}  → ${next(m)}`),
    ...noKind.map((i) => `no kind  #${i.number}  ${shown(i.title)}`),
  ];
}

// What the command says of each rename step the tracker sent ({ number, from, to, error }): renamed, or refused with
// `gh`'s line.
export const renameLines = (steps) => steps.map((s) => s.error
  ? `refused #${s.number}  ${shown(s.from)}  → ${shown(s.to)}  (${shown(s.error)})`
  : `renamed #${s.number}  ${shown(s.from)}  → ${shown(s.to)}`);
