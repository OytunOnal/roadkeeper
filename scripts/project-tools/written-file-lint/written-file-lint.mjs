// @level main
// Roadkeeper — the check at write: a file just written judged by its project's `lintFile`, run from the root of the worktree
// holding it (lib/written-file-adapters.mjs), the main checkout's install linked in when a linked worktree has none and
// pins what the main checkout pins, else the linter not run and that said; `{file}`, in any of its arguments, the
// file's path from that root. The stack's adapter reads the breaches from the run's output, its unused names left to
// the commit, and names a cause when none is read or ESLint's own sentence names one beside them, given back with the
// run's `why`, how it ended; each breach becomes a line built from fixed words, never the linter's message:
// `src/route.ts:88 max-lines-per-function 52 > 40`, a rule with no numbers `refused`, a rule id of an unknown shape
// `rule`. Beside a refusal, what the project's suppression records say of the file (lib/suppression-records.mjs): the
// records holding rows for it, a rule past the count a record allows, or rows for a file of its name under a path gone;
// a record's path shown as the file's is, control characters replaced, cut to a cap, a row's path never. The refusal's
// lines are built whole (lib/refusal-lines.mjs), each starting with the hook's name, in fixed words: the steps first,
// when there are any (a syntax error the adapter marked, said once at its first line; a re-key of rows under a path
// gone), then the breaches' lines, then the cause's, then a rule past its record's count; the hook only says them.
// Judges nothing (lib/written-file-judgement.mjs): a file outside the session's project, the clone holding the folder
// the caller names, its linked worktrees included (a repository nested in it or elsewhere is a stranger's, whose
// `lintFile` never runs); a file in no git worktree or no Roadkeeper project, a commands file missing or malformed or
// with no `lintFile`, or one with no `{file}`, a file git ignores, a path from the root starting with `-`. This entry
// hands the judgement its adapters and the refusal's lines the hook's words.

import { hookMessage } from "../../_hook.mjs";
import { CAUSES } from "../adapters/adapters.mjs";
import { refusalLines } from "./lib/refusal-lines.mjs";
import { hasNothingToRefuse, judgeWrittenFile } from "./lib/written-file-judgement.mjs";
import { WRITTEN_FILE_ADAPTERS } from "./lib/written-file-adapters.mjs";

export const HOOK = "check-at-write"; // the hook's name, its refusal's lines and its let-pass line start with

// the words the refusal's lines are said in: the hook's line, and the causes an adapter names
const REFUSAL_WORDS = Object.freeze({ message: (words) => hookMessage(HOOK, words), causes: CAUSES });

// The check at write's refusal of the file just written at `file`, an absolute path, in the session whose project holds
// the folder `project`: a promise of its lines, each whole as the hook says it, none when the file passes or is not
// judged (lib/written-file-judgement.mjs's judgeWrittenFile).
export async function writtenFileRefusal(file, project) {
  const judged = await judgeWrittenFile(file, project, WRITTEN_FILE_ADAPTERS);
  return hasNothingToRefuse(judged) ? [] : refusalLines(judged, REFUSAL_WORDS);
}
