# The naming loop

Choose the product's permanent name at the release gate. Run it as at most three rounds. The agents that generate names never judge them.

1. **Directions.** From the one-pager, write a few candidates in divergent directions: the tool, the dataset, the promise, an invented word. No lookups yet. Ask the human which directions are alive.
2. **Generate.** Spawn one `analyst` per live direction, with its model set to opus, each blind to the others: generation runs on opus, the critique on analyst's own model.
   - One direction is always the project's own vocabulary: its glossary, its data, its screens.
   - Each generator also names its direction's **ceiling**: what a name of this kind cannot do.
3. **Recombine.** Spawn one more `analyst` (opus) that sees every batch, every ceiling and the human's reactions. Brief it to cross directions, not add more of one. Skip only when the batches already share one shape.
4. **Critique.** Spawn a fresh `analyst` that wrote none of the candidates.
   - First, a **premise pass**: is there a belief every round shared and none tested? The domain word, the audience's search words, the glossary, the direction set.
   - Then each candidate, on the criteria below.
   - Keeping the working name is always a candidate. Its argument names the switching cost it avoids: repos, files, links, recall.
5. **Availability.** Spawn `fast-researcher` on the survivors: package registry, code host, domains, close trademarks. A failed lookup is reported as failed, never as free.
6. **Verdict.**
   - **Candidates refuted:** another round, in new directions.
   - **Premise refuted:** reset. Rebuild the directions around the corrected premise, and start the round count again. The best survivor so far is the bar; every generator that sees it produces at least one candidate with a different head word. One reset per gate; a second premise failure goes back to the one-pager.
   - Report the strong candidates there are. Never pad to a number.
7. **Graveyard.** Every rejected candidate, and why it died, goes into the name's ADR.

## Criteria

- What a first-time reader takes it to mean.
- How the actual audience reads, spells and finds it: often in a second language, on a phone.
- Whether it can be passed on aloud.
- Meaning against ownability: a real word means something but competes for search; an invented word owns its search but means nothing.
- Whether it survives the planned waves.
- How it sits beside the alternatives the user would reach for.

## When the name is chosen

- Legal risk is named, never judged. Near a known mark, say so; the human decides.
- The human chooses; write the ADR.
- Open a `waiting-on-you` issue for the domain: the registrar, the exact names, the price order, the DNS records to paste.
- Read the name against the design: does it sit in the register, do the wordmark and copy still read as one product? What does not, and the rename sweep, go into the launch slice.
