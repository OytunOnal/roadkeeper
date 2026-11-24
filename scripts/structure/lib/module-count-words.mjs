// @level presentation
// Roadkeeper — a module record (module-records.mjs, moduleRecords) in words, as the check's open line and the
// Architecture tab say it. Pure.

import { plural } from "../../_text.mjs";

// moduleCountWords: a module record's code files and the way in, as the check's open line and the Architecture tab say
// them: no entry, with several root files; how many of its files code outside reaches around its entry, uncovered or
// covered by an exception, the covered ones said apart; then the ones counted at an outer module, each outer module's
// path printed by `printPath` when given; with none of these, through its entry when code outside reaches it, nothing
// more when code outside reaches only its inner modules' files around their entries (the caller says those, in place
// of the way in), else not used from outside. A record with its files not listed (total null) says so. The tab's page
// embeds it by its source, beside plural.
export function moduleCountWords(record, printPath) {
  if (record.total == null) return 'files not listed';
  var parts = [plural(record.total, 'file')], at = record.pastCountedAt || [];
  var innerReached = (record.innerPast ? record.innerPast.length : 0) + (record.innerPastCut || 0) > 0;
  if (record.noEntry) parts.push('no entry');
  if (record.pastInterface && record.exceptedPast) parts.push(record.pastInterface + record.exceptedPast + ' past the interface, ' + record.exceptedPast + ' excepted');
  else if (record.pastInterface) parts.push(record.pastInterface + ' past the interface');
  else if (record.exceptedPast) parts.push(record.exceptedPast + ' past the interface, excepted');
  for (var i = 0; i < at.length; i++) parts.push(at[i][1] + ' past the interface, counted at ' + (printPath ? printPath(at[i][0]) : at[i][0]));
  if (parts.length === 1 && record.reached) parts.push('through its entry');
  else if (parts.length === 1 && !innerReached) parts.push('not used from outside');
  return parts.join(' · ');
}
