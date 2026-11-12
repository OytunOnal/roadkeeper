// @level domain
// Roadkeeper — the one merge of the Parsers port's results (../parsers.mjs), the parsers' and their parts'.

// `results`, each { tool, read, heritage, declarations, foundNowhere }, as one, in their order: the tools joined with
// " + ", a null one left out; `read`, `heritage` and `foundNowhere` concatenated; `declarations` in a prototype-free map
export const mergeResults = (results) => ({
  tool: results.map((r) => r.tool).filter((tool) => tool !== null).join(" + "),
  read: results.flatMap((r) => r.read),
  heritage: results.flatMap((r) => r.heritage),
  declarations: Object.assign(Object.create(null), ...results.map((r) => r.declarations)),
  foundNowhere: results.flatMap((r) => r.foundNowhere),
});
