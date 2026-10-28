// @level domain
// Roadkeeper — the read-by-nothing match: whether a path is one the commands file's `readByNothing` names, files the green
// never reads. A pattern reads as the structure module's file patterns do, through the `matches` the entry hands in.
// The green's own inputs are read whatever the patterns say.

// The green's own inputs: its commands, the structure check's two files, and the Ceilings the project's lint config reads
export const GREEN_READS = Object.freeze(["docs/roadkeeper/commands.json", "docs/roadkeeper/dependency-rules.md",
  "docs/roadkeeper/structure.json", "docs/roadkeeper/ceilings.json"]);

// Whether one of the patterns names the path, a repository path with `/` between its folders, and the green does not
// read it itself. `matches(pattern, path)`: the file-pattern match.
export const readByNothing = (path, patterns, matches) => !GREEN_READS.includes(path) && patterns.some((pattern) => matches(pattern, path));
