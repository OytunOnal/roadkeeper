---
name: design-critique
description: "Compare design variants (mockups or screens) and recommend one, naming the trade-off. Use when design candidates need comparing."
---

**Judge the rendered thing.** Open each variant in a browser (or screenshot it) before forming any opinion; critique what is seen on screen, never the source code.

## Per variant, in this order

1. **What works.** Concrete strengths worth keeping — named elements, not compliments.
2. **Problems.** Specific, visible, consequential: what a user hits, where the hierarchy misleads, what fights what. Each problem points at something on the screen.
3. **What to build on.** If this variant wins, the direction it grows in.

## Verdict

Compare across variants and **recommend one, naming the trade-off**: "choosing A trades X for Y." A recommendation that names no sacrifice has not compared anything. Then wait for the human's pick.

## Report

Write it to `docs/roadkeeper/critiques/<date>-design.md`. Screenshots go under `.run/critiques/<date>-design/`, out of git.

Done when every variant received all three sections and the recommendation names its trade-off.

The report is the record; what needs the human goes in the message. What only they can do becomes a `waiting-on-you` issue, written as `road` says.
