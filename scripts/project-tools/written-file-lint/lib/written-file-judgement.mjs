// @level application
// Roadkeeper — the check at write's judgement of a file just written: whether it is judged at all, the breaches its
// project's `lintFile` found, the first line a syntax error stands at, what the project's suppression records say of
// it, and the cause an adapter names, through the adapters the module's entry hands in (written-file-adapters.mjs). Judges
// nothing: a file outside the session's project, the clone holding the folder the caller names, its linked worktrees
// included; a file in no git worktree or no Roadkeeper project, a commands file missing or malformed or with no
// `lintFile`, or one with no `{file}`, a file git ignores, a path from the root starting with `-`. Its lines are
// refusal-lines.mjs's.

export const FILE = "{file}";      // lintFile's text the written file's path takes the place of
const RULE_SHOWN = 100;            // characters of a rule id kept; a longer one reads as of an unknown shape
const RULE_ID = /^(?:@[\w.-]+\/)?[A-Za-z][\w.-]*(?:\/[A-Za-z][\w.-]*)*$/; // `max-params`, `roadkeeper/named-condition`, `@scope/rule`

// Whether a breach's rule is a rule id of a known shape: a string, at most RULE_SHOWN characters, RULE_ID's.
export const isRuleId = (rule) => typeof rule === "string" && rule.length <= RULE_SHOWN && RULE_ID.test(rule);

// a breach's line number as shown: 1 when the linter gave none
export const showLineNumber = (line) => (Number.isSafeInteger(line) && line > 0 ? line : 1);

// The first line a syntax error the adapter marked (`syntaxError`) stands at, as shown; null when there is none.
function findFirstSyntaxLineOrNull(breaches) {
  const lines = breaches.filter((b) => b.syntaxError).map((b) => showLineNumber(b.line));
  return lines.length ? Math.min(...lines) : null;
}

// The breaches with a rule id, counted by rule: what the project's suppression records are read against.
function countBreachesByRule(breaches) {
  const counts = new Map();
  for (const { rule } of breaches) if (isRuleId(rule)) counts.set(rule, (counts.get(rule) ?? 0) + 1);
  return counts;
}

// Whether a judgement (judgeWrittenFile) holds nothing to refuse: no breach, no cause, no syntax error, and no install
// to make (`said`, which holds no breaches).
export const hasNothingToRefuse = ({ breaches, cause, syntaxLine }) => breaches?.length === 0 && !cause && !syntaxLine;

// The judgement of the file just written at `file`, an absolute path, in the session whose project holds the folder
// `project`: a promise of { breaches }, the breaches but its syntax errors, none when it passes or is not judged; a
// refusal's with { path, syntaxLine, holdingRecords, pastCounts, movedRows } beside them, the file's path from the root,
// the first line a syntax error stands at (findFirstSyntaxLineOrNull) and what the suppression records say
// (the adapters' recordNotes), and { cause, why } when the adapter names a cause (adapters.mjs), the breaches none when none could be
// read: the cause and how the run ended; or { said }, the line saying where to install (worktree.mjs). `adapters`: the
// entry's (written-file-adapters.mjs), { placed, sameClone, readCommands, ignored, linted, recordNotes }.
export async function judgeWrittenFile(file, project, adapters) {
  const at = adapters.placed(file);
  const ours = at && !at.path.startsWith("-") && adapters.sameClone(at.root, project);
  if (!ours) return { breaches: [] };
  const { commands } = adapters.readCommands(at.root);
  const judged = commands?.lintFile?.some((a) => a.includes(FILE)) && !adapters.ignored(at.root, at.path);
  if (!judged) return { breaches: [] };
  const { breaches = [], cause, why, said } = await adapters.linted({ ...at, commands });
  if (said) return { said };
  const syntaxLine = findFirstSyntaxLineOrNull(breaches);
  const kept = breaches.filter((b) => !b.syntaxError);
  if (hasNothingToRefuse({ breaches: kept, cause, syntaxLine })) return { breaches: kept };
  const notes = adapters.recordNotes(at.root, commands, { path: at.path, counts: countBreachesByRule(breaches) });
  const refused = { breaches: kept, path: at.path, syntaxLine, ...notes };
  return cause ? { ...refused, cause, why } : refused;
}
