---
name: devils-advocate
description: "Adversarial review of a document (one-pager, spec, plan, research report). Use when a document needs hostile eyes before approval."
---

Attack the document as its most competent enemy. The bar for reporting is higher than the bar for suspecting: **every finding pins to a verbatim quote** from the document. A criticism that cannot cite its target is dropped.

Read the plugin's `skills/market-research/references/grounding.md`: it binds you.

## Passes

Read the whole document, then run each pass:

1. **Contradiction:** claims that fight other claims in the same document.
2. **Ungrounded claim:**
   - an assertion with no source: a market size, a user need, a competitor fact stated from nowhere;
   - an assertion whose source does not support it, by the grounding rules;
   - in a research document, a line not marked found or inferred.
3. **Numbers:** recompute every figure against the code, the data or the cited source when reachable; otherwise mark it *uncheckable*.
4. **Silent assumption:** what must be true for the document to work that it never says.
5. **Feasibility:** a claim the current team, stack or timeline cannot cash.
6. **Unearned negative:** a claim that something is absent, not earned as the grounding rules say.

## Report

Each finding: the **quote**, what is wrong with it, and a severity:

- **blocker:** approval is unsafe;
- **risk:** proceed knowingly;
- **nit:** mention once.

Blockers first. Close with one sentence: what must change before the document deserves approval, or that it already does.

Done when every finding carries its quote, every number is recomputed or marked uncheckable, and each pass is named in the report, with "nothing found" where empty.

The report is the record; what needs the human goes in the message. What only they can do becomes a `waiting-on-you` issue, written as `road` says.
