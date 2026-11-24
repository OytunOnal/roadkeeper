// @level infrastructure
// Roadkeeper — the tracker's issue search, as GitHub writes it: a filter of the road model's, a counter's or the bar's,
// as the address of the search listing its issues, from the repository's address. The Road's entry hands it to the page.

// A filter of the road model's ({ state, labelsIn, labelsOut, milestone, parent }) as the tracker's issue search, the
// path after the repository's address; `sort` its order, or none.
export function issueSearch(filter, sort) {
  const terms = ["is:issue"];
  if (filter.state) terms.push(`is:${filter.state}`);
  for (const label of filter.labelsIn || []) terms.push(`label:${label}`);
  if (filter.milestone === false) terms.push("no:milestone");
  else if (filter.milestone) terms.push(`milestone:"${filter.milestone}"`);
  for (const label of filter.labelsOut || []) terms.push(`-label:${label}`);
  if (filter.parent === false) terms.push("no:parent-issue");
  if (sort) terms.push(sort);
  return `issues?q=${encodeURIComponent(terms.join(" "))}`;
}
