// @level infrastructure
// Roadkeeper — Python's coverage, read for the test sweep from the project's own install: python-coverage-start.py laid
// as `sitecustomize.py` in a folder put first on PYTHONPATH, so every Python process a run starts, its children's
// children too, imports the `coverage` its own Python has and writes the lines it ran into the data folder its
// variable names (DATA_VARIABLE). Roadkeeper ships no coverage. A process that could not start it says so there, and
// the read says the Python code was not read. Reads only that folder's plain files, at most MAX_DATA_FILES, each under
// DATA_CAP; of each file it names only those `codeFile` names as the project's code. A data file past its cap, or not
// the JSON written, is skipped and counted, never read.

import { copyFileSync, mkdirSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPlainFile } from "../../_files.mjs";
import { listDataFiles, MAX_DATA_FILES } from "./data-files.mjs";
import { joinReaches, Reach } from "./reached-lines.mjs";

const START = fileURLToPath(new URL("./python-coverage-start.py", import.meta.url)); // laid as sitecustomize.py
const SITE = "sitecustomize.py"; // the module Python imports at start from the first folder of its path holding one
// the data folder's path; python-coverage-start.py holds the same three names, a copy across the language boundary
const DATA_VARIABLE = "ROADKEEPER_PYTHON_COVERAGE";
const LINES_PREFIX = "lines-"; // a file of the lines a process ran; python-coverage-start.py's copy
const MISSING_PREFIX = "missing-"; // a process that could not start coverage; python-coverage-start.py's copy
const DATA_CAP = 64 * 1024 * 1024; // bytes of one data file: the line numbers of every file a process ran
// what a card says when a Python process of its file's run could not start coverage
const NOT_READ = "Its Python code was not read for coverage: install Python's `coverage` package where the project's tests run.";

// The run's folder made, the start file laid in its `site` folder and its `data` folder made: the variables a run is
// started under to write into `folder`, `site` first on PYTHONPATH before the one this process has.
function makeRunFolder(folder) {
  const [site, data] = [join(folder, "site"), join(folder, "data")];
  mkdirSync(site, { recursive: true });
  mkdirSync(data, { recursive: true });
  copyFileSync(START, join(site, SITE));
  return { PYTHONPATH: [site, process.env.PYTHONPATH].filter(Boolean).join(delimiter), [DATA_VARIABLE]: data };
}

// A lines file's { files } as written, or null when it is past its cap or not that JSON.
function readLinesFile(path) {
  const text = readPlainFile(path, DATA_CAP);
  try {
    const data = text === null ? null : JSON.parse(text);
    const isFilesObject = data && typeof data.files === "object" && data.files !== null && !Array.isArray(data.files);
    return isFilesObject ? data.files : null;
  } catch { return null; }
}

// The lines of the project's code one lines file's `files` names: a reach. `codeFile(absolutePath)`: its path from the
// root when it is the project's code, else null.
function readLinesReach(files, codeFile) {
  const reach = new Reach();
  for (const [file, lines] of Object.entries(files)) {
    const code = Array.isArray(lines) ? codeFile(file) : null;
    if (code !== null) reach.add(code, lines.filter((n) => Number.isSafeInteger(n) && n > 0));
  }
  return reach;
}

// What Python's coverage of one run wrote into `folder`: { reached, skipped, unread }, `reached` the lines of the
// project's code any Python process ran (a reach), `skipped` the data files not read, `unread` { language, unlisted }
// when the data folder could not be listed, `unlisted` the error's code, else NOT_READ when a process could not start
// coverage, else null. `project`:
// { root, codeFile }.
function read(folder, project) {
  const data = join(folder, "data");
  const { names, unlisted } = listDataFiles(data);
  const lines = names.filter((n) => n.startsWith(LINES_PREFIX));
  const filesRead = lines.slice(0, MAX_DATA_FILES).map((name) => readLinesFile(join(data, name)));
  const reached = joinReaches(filesRead.filter(Boolean).map((files) => readLinesReach(files, project.codeFile)));
  const skipped = Math.max(0, lines.length - MAX_DATA_FILES) + filesRead.filter((f) => !f).length;
  if (unlisted) return { reached, skipped, unread: { language: "Python", unlisted } };
  return { reached, skipped, unread: names.some((n) => n.startsWith(MISSING_PREFIX)) ? NOT_READ : null };
}

// Python's coverage reader: its name, its run's folder made, and its read.
export const pythonCoverage = { name: "python", makeRunFolder, read };
