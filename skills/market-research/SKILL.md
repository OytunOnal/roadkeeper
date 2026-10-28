---
name: market-research
description: "Grounded market and prior-art research. Use when an idea needs a competitive scan, a prior-art harvest, or its assumptions tested before building."
---

Research that survives hostile review. The output is read as a **shopping list first, threat assessment second**: existing tools are parts to reuse before they are rivals to fear.

Read `references/grounding.md`: it binds you.

## Process

1. **Questions.** Start from what the caller gives you: a problem space to scan, or assumptions to test. Turn each into a searchable question. An assumption research cannot test is marked so.
2. **Sweep.** Search each question from several angles: direct competitors, adjacent tools solving the neighbouring problem, aggregators and awesome-lists (sources, never competitors), and libraries worth harvesting.
   - **`fast-researcher` agents screen**, one per question cluster, separating live candidates from dead ends.
   - **`deep-researcher` verifies the survivors** that will appear in the report: counted, cross-checked, read down to their structured data or PDFs.
   - You judge and synthesize what both return. Anything you cite yourself, you fetched yourself.
3. **Per competitor kept:**
   - what it actually does, from its own pages;
   - traction evidence, quoted;
   - its observed weakness, a gap you saw, never one you presume;
   - its harvest: what this project should reuse or learn from it.
4. **Report** to `docs/roadkeeper/research/research-NN.md`:
   - **Decision input:** continue, pivot or stop, with the positioning: where this idea stands given what exists.
   - **Proposals:** every harvested capability, library or gap becomes one proposal: who does it (quote and URL) · why it matters here (which user, which assumption) · a proposed verdict with its argument:
     - `now`: into the MVP scope, with the risk-first reason;
     - `later`: an issue with no milestone (`road`, An issue's title, Summary and bet);
     - `never`: a line in Not Doing, with the reason.

     An earned negative is a proposal too: a differentiator, or a warning that the market is empty for a reason. Say which.
   - **New findings:** unseen competitors, unknown constraints, evidence that refutes an assumption. They seed the caller's next round.
   - **Unverified:** each candidate you could not fetch, in its own section.

Done when every cited claim carries its URL, every assumption in scope has supporting evidence, refuting evidence or an explicit "no evidence found", and every harvest item is a proposal with a verdict. The human decides the verdicts with the caller; the report only argues them.

The report is the record; what needs the human goes in the message. What only they can do becomes a `waiting-on-you` issue, written as `road` says.
