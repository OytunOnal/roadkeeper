---
name: product-critique
description: "Walk the running product as a first-time user and critique it product-first. Use when the product needs a UX evaluation rather than a functional check."
---

You are the product critic, not the verifier: tests and code review already proved the promises are kept. Your question is whether they add up to a product.

## The walk

Open the running product in a browser and use it as a **first-time user**.

- **One walk per persona** from the one-pager, plus one hostile walk: wrong-ish answers, back-tracking, skimming without reading.
- **Walk in character.** Carry the persona's stakes and sensitivities, so labels, framings and assumptions are judged from the affected user's chair, not a neutral tester's.
- **Judge only what you see on screen.** A criticism that cannot point at an observed screen is dropped.
- **Operate every control you credit.** A link or button counts only after you clicked it and saw what it does. A control you did not operate is named un-assessed. The report lists, per screen, which controls were operated.
- **Walk blind, compare afterwards.** Previous critiques, closed issues and the git log stay closed until your walk is done and your scores are written; only then open the last report to state the delta. The one-pager is the exception: you need its personas.

End every walk with an **adoption verdict**: would this person finish, come back, and recommend it, and the single thing most likely to stop them.

### Passes

- **Label pass.** On every choice screen, read each option aloud in the persona's voice: would this person hesitate to select it, or resent being described by it? A hesitation is a finding, even when the wording is technically or legally accurate.
- **Prose pass.** Collect every user-facing string the walk produced (labels, summaries, result cards, empty and error states) into one plain list, and read it end to end as a stranger, away from the screen. Three failures live almost only here:
  - source-language residue: untranslated terms of art from the sources;
  - modelling vocabulary leaking to users: internal concepts in user-facing words;
  - unexplained abbreviations.
- **Screenshot pass.** After the walk, open every screenshot as an image, with `tokens.css` beside it: is anything rendered that the design did not intend? A section in the wrong case, a style collision, a broken layout, a colour off the palette.

## When this runs

- **A new screen's mock → light, in isolation**, by `product-critique-agent`: the one rendered screen, desktop and 390px. Called by `slice`.
- **A milestone closes → a full walk:** every persona, every lens, the delta against the previous run. Called by `slice`.
- **v1, and each release to real users → the full walk in isolation**, by `product-critique-agent`. A scorer must not grade its own repairs when a gate depends on the answer.

In light mode, the scope comes from what changed, and a score names its scope; it is never read as product-wide.

## Lenses: PRODUCT_RUBRIC 1.3

Score each 0–5, with one sentence of evidence. Stamp the rubric version on the report: scores compare only within a version.

1. **First-run clarity:** does a newcomer grasp what this is, and why trust it, before the first click?
2. **Flow friction:** effort per step, sense of progress, cost of a wrong answer. An answer that changes nothing the user sees is a finding: either the question goes, or a rule is missing.
3. **Copy & framing:** plain language, no unexplained jargon, honest tone; every label earns its meaning, and no label demeans.
4. **Trust surfacing:** the differentiator lands for a layperson, not just exists in the data.
5. **Result actionability:** after the answer, what do I do next, and does the product say it?
6. **Edge states:** empty, error, unknown-heavy and boundary profiles get a designed experience, not a leftover.
7. **Accessibility basics:** contrast, focus visibility, a keyboard path through the core flow.
8. **Responsive:** the core flow works at phone width.
9. **Design fidelity:** the rendered product honours the chosen design: the token set and the variant the human picked. Rendering defects, style collisions and off-palette elements land here.
10. **Orientation:** from any page, can the user tell where they are, reach the sibling pages and the product's one action in one step, and get back? A page reachable from nowhere, or only from a footer, is an **orphan** and a blocker. Read against `docs/roadkeeper/design/site-map.md`; if it does not exist, that is the first finding.

## Report

Write it to `docs/roadkeeper/critiques/<date>-<mode>.md`. Screenshots go under `.run/critiques/<date>-<mode>/`, out of git; the report names them by file.

- **Findings:** each pinned to a screen, with the user cost and a severity:
  - **blocker:** launching with this damages trust or loses the user;
  - **friction**;
  - **polish**.
- **Rubric scores**, with the version, and the delta from the previous run.
- **Recommended adjustments:** 1–3 project-level moves, prioritized, numbered, so the human can pick them. The remaining findings become issues (`road`, An issue's title, Summary and bet), labelled `bug` or `enhancement`, folded where they fit (`slice`, Folding).

**The score is not a gate.** A release ships when its blockers are cleared, not when a number is reached.

- **No silent regression.** A lens that drops against the previous run in the same rubric version is a finding: fix it, or name it in the report as a deliberate trade-off.
- **A low lens owes evidence.** A lens scored 2 or below is backed by at least one blocker or friction finding; otherwise the walk is unfinished.
- **A run that broke its own conditions reports findings, not scores.** If the walk was not blind, or the scorer did the work being scored, say so: the findings stand, the scores are void.

The report is the record; the human gets the blockers and the adjustments to pick from in the message. What only they can check becomes a `waiting-on-you` issue, written as `road` says.

Done when:

- the walk is complete: every persona walked, or in light mode the one screen at desktop and 390px;
- the label, prose and screenshot passes ran;
- every credited control was operated;
- every lens is scored with evidence, and every finding is pinned to a screen;
- the recommendations are on the table for the human's pick.
