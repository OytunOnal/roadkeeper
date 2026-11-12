// @level infrastructure
// Roadkeeper — the green's inputs and its doc tests: the commands file read, the tests' setup where a `{tests}` step or
// doc tests need it, and the lint rules' copy held to the plugin's; the lists `docTests` and `notDocTests` name; their
// check on a full green, each test file naming a path `readByNothing` lists by the reader scan on paths alone
// (reader-scan.mjs) in one of them; and the doc tests run alone on a tree differing from a stamped one only in files no
// step reads. A file pattern reads through the `matches` the entry hands in. Reads the commands file, the tree's file
// list and its test files' text; runs only the doc tests, through test-run.mjs.

import { plural } from "../../_text.mjs";
import { declaresDocTests, readCommands } from "./commands-file.mjs";
import { shownName, workingFile, workingFiles } from "./commit-tree.mjs";
import { readByNothing } from "./read-by-nothing.mjs";
import { readerScan } from "./reader-scan.mjs";
import { COPY_COMMAND, RULES_COPY, copyDiffers } from "./rules-copy.mjs";
import { isTestsStep } from "./steps-run.mjs";
import { testFileMatcher, testSetup, testsStepPasses, worktreeTests } from "./test-run.mjs";

// The commands file of the project at `root` and, where a `{tests}` step or `docTests` needs it, its tests' setup
// (test-run.mjs): { commands, tests }, or { code }, the green's exit code once the line saying why is handed to `say`:
// 2 refused, 1 red for a rules copy differing from the plugin's. `place`: { root, matches }.
export function greenInputs({ root, matches }, say) {
  const { commands, refused } = readCommands(root);
  if (refused) { say(`green: ${refused}`); return { code: 2 }; }
  const testsRun = commands.green.some(isTestsStep) || declaresDocTests(commands);
  const tests = testsRun ? testSetup({ dir: root, matches }) : null;
  if (tests?.refused) { say(`green: ${tests.refused}`); return { code: 2 }; }
  if (!copyDiffers(root)) return { commands, tests };
  say(`green: red, ${RULES_COPY}/ differs from the plugin's lint rules; copy them: ${COPY_COMMAND}`);
  return { code: 1 };
}

// The test files the commands file's list `key` (`docTests`, `notDocTests`) names, by their paths from the root `root`,
// each a plain file inside it with no link on the way: { files }, none when it names none; or { missing }, the line
// naming the first entry that names no such file.
function namedTests(root, commands, key) {
  const names = commands[key] ?? [];
  const files = names.map((name) => workingFile(root, name));
  const at = files.indexOf(null);
  return at < 0 ? { files: [...new Set(files)] } : { missing: `${key} names ${shownName(names[at])}, no file of this tree` };
}

// The doc-test lists of the project at `root`: { docTests, named }, `docTests` the files `docTests` names, `named`
// those both lists name, as a set; or { missing }, the line naming the first entry, `docTests`' first, naming no file.
export function docTestLists(root, commands) {
  const [docTests, notDocTests] = [namedTests(root, commands, "docTests"), namedTests(root, commands, "notDocTests")];
  const missing = docTests.missing ?? notDocTests.missing;
  return missing ? { missing } : { docTests: docTests.files, named: new Set([...docTests.files, ...notDocTests.files]) };
}

// The doc-test lists' check of a full green: each test file of the tree (testFileMatcher's) whose own text names the
// path of a file `readByNothing` lists, by the reader scan on paths alone, is among `named` (docTestLists'). Where the
// tree holds a listed file, says how many test files it read, then a line for each test in neither list: red where the
// commands file declares `docTests`, else naming the key to add. `run`: { root, commands, named, matches }. Whether
// the green goes on.
export function docTestListsPass({ root, commands, named, matches }, say) {
  const listed = workingFiles(root).filter((path) => readByNothing(path, commands.readByNothing, matches));
  if (!listed.length) return true;
  const tests = worktreeTests({ root, isTest: testFileMatcher(commands, matches) });
  const scan = readerScan({ root, tests, changed: listed, byNames: false });
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
// step runs its files (test-run.mjs), none named running nothing. `run`: { tests, files, tree, near }, `tests`
// testSetup's. A promise of whether they passed.
export async function docTestsPass({ tests, files, tree, near }, say) {
  say(`green: this tree (${tree.slice(0, 12)}) differs from the green tree ${near.slice(0, 12)} only in files no step ` +
    `reads; ${plural(files.length, "doc test")} run, no other step`);
  return files.length ? testsStepPasses(tests, say, files) : true;
}
