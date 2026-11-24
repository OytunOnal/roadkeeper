// @level application
// Roadkeeper — the green's inputs and its doc tests: the commands file read, the tests' setup where a `{tests}` step or
// doc tests need it, and the lint rules' copy held to the plugin's; the lists `docTests` and `notDocTests` name; their
// check on a full green, each test file naming a path `readByNothing` lists by the reader scan on paths alone
// (reader-scan.mjs) in one of them; and the doc tests run alone on a tree differing from a stamped one only in files no
// step reads. A file pattern reads through the `matches` the entry hands in. Reads the commands file, the tree's file
// list and its test files' text; runs only the doc tests, through test-run.mjs; each through the adapters the entry
// hands in.

import { plural } from "../../_text.mjs";
import { declaresDocTests, isTestsStep } from "./commands-fields.mjs";
import { readByNothing } from "./read-by-nothing.mjs";
import { shownName } from "./shown-name.mjs";

// The commands file of the project at `root` and, where a `{tests}` step or `docTests` needs it, its tests' setup
// (test-run.mjs): { commands, tests }, or { code }, the green's exit code once the line saying why is handed to `say`:
// 2 refused, 1 red for a rules copy differing from the plugin's. `place`: { root, matches, words, adapters }, `words`
// the lines the runs say (testSetup's), `adapters` the commands file, rules copy and test run calls the entry hands in.
export function greenInputs({ root, matches, words, adapters }, say) {
  const { commands, refused } = adapters.readCommands(root);
  if (refused) { say(`green: ${refused}`); return { code: 2 }; }
  const testsRun = commands.green.some(isTestsStep) || declaresDocTests(commands);
  const tests = testsRun ? adapters.testSetup({ dir: root, matches, words }) : null;
  if (tests?.refused) { say(`green: ${tests.refused}`); return { code: 2 }; }
  if (!adapters.copyDiffers(root)) return { commands, tests };
  say(`green: red, ${adapters.RULES_COPY}/ differs from the plugin's lint rules; copy them: ${adapters.COPY_COMMAND}`);
  return { code: 1 };
}

// The test files the commands file's list `key` (`docTests`, `notDocTests`) names, by their paths from the root `root`,
// each a plain file inside it with no link on the way: { files }, none when it names none; or { missing }, the line
// naming the first entry that names no such file.
function namedTests({ root, adapters }, commands, key) {
  const names = commands[key] ?? [];
  const files = names.map((name) => adapters.workingFile(root, name));
  const at = files.indexOf(null);
  return at < 0 ? { files: [...new Set(files)] } : { missing: `${key} names ${shownName(names[at])}, no file of this tree` };
}

// The doc-test lists of the project at `place.root`: { docTests, named }, `docTests` the files `docTests` names, `named`
// those both lists name, as a set; or { missing }, the line naming the first entry, `docTests`' first, naming no file.
// `place`: { root, adapters }.
export function docTestLists(place, commands) {
  const [docTests, notDocTests] = [namedTests(place, commands, "docTests"), namedTests(place, commands, "notDocTests")];
  const missing = docTests.missing ?? notDocTests.missing;
  return missing ? { missing } : { docTests: docTests.files, named: new Set([...docTests.files, ...notDocTests.files]) };
}

// The doc-test lists' check of a full green: each test file of the tree (testFileMatcher's) whose own text names the
// path of a file `readByNothing` lists, by the reader scan on paths alone, is among `named` (docTestLists'). Where the
// tree holds a listed file, says how many test files it read, then a line for each test in neither list: red where the
// commands file declares `docTests`, else naming the key to add. `run`: { root, commands, named, matches, adapters }.
// Whether the green goes on.
export function docTestListsPass({ root, commands, named, matches, adapters }, say) {
  const listed = adapters.workingFiles(root).filter((path) => readByNothing(path, commands.readByNothing, matches));
  if (!listed.length) return true;
  const tests = adapters.worktreeTests({ root, isTest: adapters.testFileMatcher(commands, matches) });
  const scan = adapters.readerScan({ root, tests, changed: listed, byNames: false, readsComments: true });
  for (const line of scan.said) say(`green: ${line}`);
  say(`green: ${plural(scan.read, "test file")} read for the ${plural(listed.length, "file")} readByNothing lists`);
  const unlisted = scan.readers.filter((reader) => !named.has(reader.file));
  const declared = declaresDocTests(commands);
  for (const reader of unlisted) {
    const [file, path] = [shownName(reader.file), shownName(reader.reads[0])];
    say(declared ? `green: red, ${file} names ${path}, which readByNothing lists, in neither docTests nor notDocTests`
      : `green: ${file} names ${path}, which readByNothing lists; add \`docTests\` naming it, or \`notDocTests\` when it ` +
        "reads none");
  }
  return !declared || !unlisted.length;
}

// A tree differing from the green tree `near` only in files no step reads: its doc tests alone run as the `{tests}`
// step runs its files (test-run.mjs), none named running nothing. `run`: { tests, files, tree, near, adapters },
// `tests` testSetup's. A promise of { passes, failed }, testsStepRun's.
export async function docTestsRun({ tests, files, tree, near, adapters }, say) {
  const { shortHash } = adapters;
  say(`green: this tree (${shortHash(tree)}) differs from the green tree ${shortHash(near)} only in files no step ` +
    `reads; ${plural(files.length, "doc test")} run, no other step`);
  return files.length ? adapters.testsStepRun(tests, say, files) : { passes: true, failed: [] };
}
