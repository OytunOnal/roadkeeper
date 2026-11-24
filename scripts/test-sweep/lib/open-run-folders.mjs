// @level infrastructure
// Roadkeeper — the test sweep's run folders on disk: each run's folder under the work folder, a folder in it for each
// coverage reader (coverage-readers.mjs), the run's results file beside them, what the readers read there, and the
// folder removed once read. The sweep's entry hands them to its runs (sweep-runs.mjs).

import { rmSync } from "node:fs";
import { join } from "node:path";
import { COVERAGE_READERS } from "./coverage-readers.mjs";

// The run folders under `work`, the coverage read as `project` ({ root, codeFile }) names the project's code:
// `make({ file, keep, name })`, each reader's folder made under the run's folder `name` names, { run, folder }, `run`
// the run's { file, keep, addedEnv, out } as the project tools take it; `read(folder)`, each reader's { name, reached,
// skipped, unread } of the run in `folder`; `remove(folder)`, the folder removed.
export function openRunFolders(work, project) {
  const make = ({ file, keep, name }) => {
    const folder = join(work, name);
    const addedEnv = Object.assign(Object.create(null), ...COVERAGE_READERS.map((r) => r.makeRunFolder(join(folder, r.name))));
    return { run: { file, keep, addedEnv, out: join(folder, "results.xml") }, folder };
  };
  const read = (folder) => COVERAGE_READERS.map((r) => ({ name: r.name, ...r.read(join(folder, r.name), project) }));
  const remove = (folder) => rmSync(folder, { recursive: true, force: true });
  return { make, read, remove };
}
