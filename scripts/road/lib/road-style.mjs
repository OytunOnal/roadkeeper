// @level presentation
// Roadkeeper — The Road's page's CSS, with the page's own furniture: tabs, folds, the unreadable line. Its colours, font
// stacks and scroll shadow are the token file's names (scripts/road/tokens.css), inlined before it.

import { SLICES_SHARE } from "./road-model.mjs";

// the page's style sheet, after the tokens and before the Architecture tab's own
export const ROAD_STYLE = `
  body { background: var(--ground); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.5; margin: 0; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 40px 20px 72px; }
  h1, h2, h3, .slice .heading { font-family: var(--display); font-weight: 600; margin: 0; }
  h1, h2 { text-wrap: balance; }
  h1 { font-size: 40px; line-height: 1.05; letter-spacing: -0.01em; }
  h2 { font-size: 22px; margin: 44px 0 14px; padding-top: 18px; border-top: 1px solid var(--line); }
  /* not balanced: a title fills its line as the body beneath it does */
  h3, .slice .heading { font-size: 18px; line-height: 1.25; font-weight: 500; }
  h4, h5, h6 { font-family: var(--display); font-size: 15px; font-weight: 600; margin: 16px 0 4px; }
  p { margin: 0; }
  p + p { margin-top: 10px; }
  a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
  a:focus-visible, .legend-box > summary:focus-visible, button.more:focus-visible, .group summary:focus-visible,
  .fold > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* "#N title", one link: the number in a link's look, the title in its own colour, underlined on hover */
  a.issue { color: inherit; text-decoration: none; }
  a.issue .number { color: var(--accent); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
  a.issue:hover .title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
  .mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }

  /* the current milestone's bar: the slices' track, nine tenths, in done's fill, filled in done to its share of slices
     done; past a gap, the release's tenth in the planned marker's look, "release" under it. Its margin spaces it from
     the part before it as the counters' cards are spaced; a rule above and below, a heading's, sets it apart from the
     cards and the key */
  .progress { position: relative; margin-top: 26px; padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); } /* 14px inside the rules, a rail row's own padding */
  .progress .t { font-family: var(--display); font-size: 17px; font-weight: 600; }
  /* the count reads after the milestone's name, lighter than it */
  .progress .t .count { font-family: var(--body); font-weight: 400; color: var(--muted); }
  .meter { display: flex; gap: 3px; height: 12px; margin-top: 8px; } /* the gap, 3px of ground, the ring a marker on the rail draws */
  .meter .track { flex: 0 0 ${SLICES_SHARE}%; background: var(--done-soft); }
  .meter .fill { height: 100%; background: var(--done); }
  .meter .release { flex: 1; box-sizing: border-box; }
  .progress .release-word { font-size: 12px; color: var(--muted); text-align: right; margin-top: 4px; } /* 4px, half the ready line's 8px: the word reads as the release's */
  .progress .ready { font-size: 14px; margin-top: 8px; }
  /* "ready to close" lands on the anchor at the part's middle, half the window under the window's top: the part sits
     centred in the window, whatever its height */
  #ready-to-close { position: absolute; top: 50%; scroll-margin-top: 50vh; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 26px; }
  .kpi { background: var(--paper); border: 1px solid var(--line); padding: 14px 16px; display: grid; grid-template-rows: auto 1fr auto; }
  .kpi .n { font-family: var(--mono); font-size: 26px; font-weight: 500; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi .l { color: var(--muted); font-size: 13px; margin-top: 6px; min-height: 2.6em; }
  .kpi .s { color: var(--muted); font-size: 12px; font-family: var(--mono); margin-top: 8px; }

  .legend { display: grid; grid-template-columns: 1fr; gap: 6px 18px; margin-top: 16px; font-size: 13px; color: var(--muted); }
  .legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
  .legend .g::before { background: var(--done); }
  .legend .a::before { background: var(--warn); }
  .legend .c::before { background: transparent; border: 1.5px dashed var(--planned); }
  .legend .v::before { vertical-align: -2px; }
  .legend b { color: var(--ink); font-weight: 500; }
  /* the legend's group: a heading to open it below 560 px; wider, the legend shows whatever its state where the browser
     has ::details-content, and the heading stays to open it where it has not */
  .legend-box > summary { margin-top: 12px; cursor: pointer; list-style: none; font-size: 13px; color: var(--muted); }
  .legend-box > summary::-webkit-details-marker { display: none; }
  .legend-box > summary .t::before { content: "\\25B8"; display: inline-block; width: 1em; }
  .legend-box[open] > summary .t::before { content: "\\25BE"; }
  @supports selector(::details-content) {
    @media (width >= 560px) {
      .legend-box > summary { display: none; }
      .legend-box::details-content { content-visibility: visible; }
    }
  }

  .rail { position: relative; margin-top: 8px; padding-left: 0; list-style: none; }
  /* the rail runs down the middle of the markers' column (112px + 10px gap + half its 40px), each marker centred in it */
  .rail::before { content: ""; position: absolute; left: 141px; top: 0; bottom: 0; width: 2px; background: var(--accent); opacity: 0.55; }
  .slice { display: grid; grid-template-columns: 112px 40px 1fr; gap: 0 10px; padding: 14px 0; align-items: start; }
  .slice .when { font-family: var(--mono); font-size: 12px; color: var(--muted); text-align: right; padding-top: 4px; line-height: 1.5; }
  .slice .dot { position: relative; height: 100%; }
  .slice .dot::before { content: ""; position: absolute; left: 50%; translate: -50% 0; top: 7px; width: 12px; height: 12px; border-radius: 50%; background: var(--done); box-shadow: 0 0 0 3px var(--ground); }
  .slice.now .dot::before { background: var(--warn); }
  .slice.cand .dot::before { background: var(--ground); border: 1.5px dashed var(--planned); }
  .slice .body p { color: var(--muted); font-size: 14px; margin-top: 4px; }
  .slice .body p.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  button.more { font: 500 12px var(--mono); color: var(--accent); background: none; border: 1px solid var(--line); border-radius: 3px; padding: 2px 8px; margin-top: 4px; cursor: pointer; }
  button.more:hover { border-color: var(--accent); }
  /* an open card's "less" in a bar at its foot, on the ground under a thin rule: it sticks to the window's foot while
     the card spans it and rests at the card's end; the card's text passes under it */
  .slice.open .less-bar { position: sticky; bottom: 0; z-index: 1; background: var(--ground); border-top: 1px solid var(--line); margin-top: 10px; padding: 6px 0 8px; }
  .slice.open .less-bar button.more { margin-top: 0; }
  /* an open card's heading line, on the ground over a thin rule: it sticks to the window's top while the card spans
     it and rests in place at the card's top, its text where a closed card's sits; a closed card's stays in place */
  .slice.open .heading { position: sticky; top: 0; z-index: 1; background: var(--ground); border-bottom: 1px solid var(--line); padding: 6px 0; margin-top: -6px; }
  .slice.cand h3 { color: var(--muted); }
  .divider { display: grid; grid-template-columns: 112px 40px 1fr; gap: 0 10px; align-items: center; margin: 10px 0 2px; }
  .divider .t { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .group { margin-top: 10px; }
  .group summary { display: grid; grid-template-columns: 112px 40px 1fr; gap: 0 10px; align-items: baseline; cursor: pointer; list-style: none; padding: 8px 0; border-top: 1px solid var(--line); }
  .group summary::-webkit-details-marker { display: none; }
  .group summary .t { grid-column: 3; font-family: var(--display); font-size: 17px; font-weight: 600; color: var(--ink); }
  .group summary .t::before { content: "\\25B8"; display: inline-block; width: 1em; color: var(--muted); transition: transform .15s; }
  .group[open] > summary .t::before { transform: rotate(90deg); }
  .group summary .n { grid-column: 3; font-family: var(--mono); font-size: 12px; color: var(--muted); }
  .group .group { margin-top: 0; }
  .group .group summary .t { font-size: 15px; }
  @media (prefers-reduced-motion: reduce) { .group summary .t::before { transition: none; } }
  .stamp { display: grid; grid-template-columns: 112px 40px 1fr; gap: 0 10px; align-items: center; margin: 6px 0; }
  .stamp .bar { height: 2px; position: relative; } /* holds the marker and draws no line: the marker is a square on the rail */
  .stamp .bar::before { content: ""; position: absolute; left: 50%; translate: -50% 0; top: -6px; }
  .stamp .v { font-family: var(--mono); font-size: 13px; color: var(--accent); font-weight: 500; }
  .stamp .v small { color: var(--muted); font-weight: 400; margin-left: 8px; }
  .stamp.plan .v { color: var(--muted); }
  .tag { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; padding: 1px 6px; border: 1px solid var(--line); color: var(--muted); margin-left: 8px; vertical-align: 2px; white-space: nowrap; }
  .tag.g { color: var(--done); border-color: var(--done); background: var(--done-soft); }
  /* active, and "waits on your word": the waiting colours, Waiting on you's */
  .tag.a, .tag.wait { color: var(--warn); border-color: var(--warn); background: var(--warn-soft); }
  .tag.ver { color: var(--accent); border-color: var(--accent-soft); text-transform: none; }
  /* an issue's heading: its h3 names the issue alone, inline, and what sits beside it follows on its line; the line
     takes the h3's face, size and height from the h3's rules above, so it reads as one heading */
  .slice .heading > h3 { display: inline; }
  .slice .beside .merged { margin-left: 8px; }
  /* the space before the chips sets their 8px from a word, whatever the face, and collapses at a line's start; the
     first chip takes no margin of its own, so chips alone start at the title's edge */
  .slice .heading > .gap { font-size: 0; word-spacing: 8px; }
  .slice .beside > :first-child { margin-left: 0; }
  /* "real-use check #N" and "specced from #N": a state badge's box, unfilled, in lower case */
  .tag.ref { text-transform: none; }

  .scroll { overflow-x: auto; position: relative; background:
    linear-gradient(90deg, var(--ground) 30%, transparent) left / 24px 100% no-repeat local,
    linear-gradient(270deg, var(--ground) 30%, transparent) right / 24px 100% no-repeat local,
    linear-gradient(90deg, var(--shadow), transparent) left / 12px 100% no-repeat scroll,
    linear-gradient(270deg, var(--shadow), transparent) right / 12px 100% no-repeat scroll; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); font-weight: 500; }
  td.num { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  th:first-child, td:first-child { position: sticky; left: 0; background: var(--ground); }

  /* the generated page's own furniture: tabs, folds, the unreadable line */
  .tabs { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 26px; border-bottom: 1px solid var(--line); }
  .tabs a { font-family: var(--display); font-size: 15px; font-weight: 600; color: var(--muted); text-decoration: none; padding: 8px 12px; border: 1px solid transparent; border-bottom: none; }
  .tabs a[aria-current="page"] { color: var(--ink); background: var(--paper); border-color: var(--line); }
  /* what waits, counted as a notification's badge, in the waiting colours */
  .tabs a .badge { display: inline-block; font-family: var(--mono); font-size: 11px; font-weight: 500; line-height: 16px; color: var(--warn); background: var(--warn-soft); border: 1px solid var(--warn); border-radius: 9px; padding: 0 6px; margin-left: 6px; vertical-align: 1px; }
  .tab { display: none; }
  .tab.on { display: block; }
  .tab > h2:first-child, .tab > p.s:first-child + h2 { margin-top: 28px; padding-top: 0; border-top: 0; } /* the nav names the tab: no heading repeats it */
  .tab > :first-child:not(h2) { margin-top: 24px; } /* the nav already rules the line: no second one under it */
  /* read by a screen reader, drawn nowhere and taking no room */
  .unseen { position: absolute; width: 1px; height: 1px; margin: 0; padding: 0; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .card { background: var(--paper); border: 1px solid var(--line); border-left: 3px solid var(--warn); padding: 14px 16px; margin-top: 12px; }
  .card h3 { margin-bottom: 6px; }
  .card p, .card ul { font-size: 14px; color: var(--muted); }
  .fold { border-top: 1px solid var(--line); padding: 8px 0; }
  .fold > summary { cursor: pointer; font-family: var(--display); font-weight: 600; font-size: 15px; }
  .fold .n, .n { font-family: var(--mono); font-size: 12px; font-weight: 400; color: var(--muted); }
  .fold > *:not(summary) { margin-top: 8px; }
  .s { color: var(--muted); font-size: 12px; font-family: var(--mono); margin-top: 8px; }
  .note { color: var(--muted); font-size: 13px; font-style: italic; margin-top: 8px; }
  .unread, .flag { color: var(--warn); font-size: 13px; font-family: var(--mono); background: var(--warn-soft); border: 1px solid var(--warn); padding: 6px 10px; margin: 8px 0; display: block; }
  /* the structure report's lines keep the check's column spacing */
  .unread.report { white-space: pre-wrap; overflow-wrap: anywhere; }
  pre.code, pre.mermaid { background: var(--paper); border: 1px solid var(--line); padding: 10px 12px; overflow-x: auto; font-family: var(--mono); font-size: 13px; }
  code { font-family: var(--mono); font-size: 0.92em; overflow-wrap: anywhere; }
  pre code { overflow-wrap: normal; }
  #tab-architecture > h3, #tab-architecture > h4 { margin-top: 24px; }
  html { scrollbar-gutter: stable; }
  blockquote { border-left: 2px solid var(--line); margin: 8px 0; padding-left: 12px; color: var(--muted); }
  hr { border: none; border-top: 1px solid var(--line); margin: 16px 0; }
  @media (max-width: 560px) {
    .rail::before { left: 19px; }
    .slice, .stamp, .divider { grid-template-columns: 40px 1fr; }
    .group summary { grid-template-columns: 40px 1fr; }
    .group summary .t, .group summary .n { grid-column: 2; }
    .slice .when { grid-column: 2; text-align: left; order: 1; padding-top: 0; }
    .slice .dot { grid-column: 1; grid-row: 1 / span 2; }
    .slice .body { grid-column: 2; }
    .divider .when { display: none; }
    .divider .t { grid-column: 2; }
    .stamp .when { display: none; }
    .stamp .bar { grid-column: 1; } /* the marker stays the named bar's, centred in the rail's column */
    .stamp .v { grid-column: 2; }
    .kpis { grid-template-columns: 1fr 1fr; }
    .kpi .l { min-height: 0; }
    .legend { grid-template-columns: 1fr 1fr; }
    .tabs a { padding: 8px; font-size: 14px; }
  }
  /* below 560 px each counter is one line, the number then its label, the whole line its tracker link */
  @media (width < 560px) {
    .kpis { grid-template-columns: 1fr; gap: 0; margin-top: 18px; }
    .kpi { display: flex; align-items: baseline; gap: 10px; position: relative; padding: 4px 12px; }
    .kpi + .kpi { border-top: none; }
    .kpi .n { font-size: 17px; flex: none; }
    .kpi .l { margin-top: 0; min-height: 0; }
    .kpi .s { font-size: 0; margin: 0; }
    .kpi .s a { position: absolute; inset: 0; }
    .legend-box .legend { margin-top: 8px; }
  }
  /* the four KPI cards sit in one row on a wide screen: three-plus-an-orphan read as a mistake */
  @media (min-width: 860px) { .kpis { grid-template-columns: repeat(4, 1fr); } }

  /* the lead, what the project is, under the title: the page's text size, filling the column as its other prose does */
  .lead { color: var(--ink); margin-top: 12px; }
  .slice.shut .dot::before { background: var(--done); border-radius: 0; transform: rotate(45deg) scale(0.8); }
  .slice.shut h3 { color: var(--muted); }
  .card.late { background: var(--warn-soft); }
  .fold ul { padding-left: 18px; font-size: 14px; margin: 8px 0 0; }
  .fold li { margin-bottom: 4px; }
  .slice .full { display: none; margin-top: 6px; }
  .slice.open .full { display: block; }
  .slice.open .body p.sum { display: none; }
  .slice .full p, .slice .full ul, .slice .full ol { color: var(--muted); font-size: 14px; }
  .slice .full h4.part { margin-top: 14px; } /* the detail's own parts, Tickets and Comments; a body's headings keep 16px */
  .comment { border-left: 2px solid var(--line); padding-left: 10px; margin-top: 8px; }
  .comment .s { margin-top: 0; }
  .slice.mock .dot::before { background: var(--done-soft); border: 2px solid var(--done); }
  .tag.m { color: var(--done); border-color: var(--done); background: transparent; }
  .legend .m::before { background: var(--done-soft); border: 1.5px solid var(--done); }

  /* the milestone marker: one rule draws the road's marker, on the bar at every width, and the key's swatch; the
     planned one is dashed on the ground, ringed as the released one is, and the progress bar's release tenth with it */
  .stamp .bar::before, .legend .v::before { width: 14px; height: 14px; box-sizing: border-box; border-radius: 0; background: var(--accent); border: 0; box-shadow: 0 0 0 3px var(--ground); }
  .stamp.plan .bar::before, .legend .v.plan::before, .meter .release { background: var(--ground); border: 1.5px dashed var(--planned); }`;
