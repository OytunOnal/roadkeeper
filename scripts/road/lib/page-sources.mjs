// @level infrastructure
// Roadkeeper — the page's sources: what The Road draws besides the tracker and the structure, read from the project's disk.
//
// Reads, under the project root, when present: docs/roadkeeper/metrics.md, ARCHITECTURE.md and one-pager.md. Refuses a file
// that is a link, sits under a linked docs/ or docs/roadkeeper/, or is over MAX_FILE (metrics.md over METRICS_CAP);
// ARCHITECTURE.md is cut to MAX_RECORD. The structure is the structure module's to read.
// Reads also the token file The Road's entry names, by default the plugin's own: refused when it is a link, not a file
// or over TOKENS_CAP. It is the plugin's, trusted as the plugin's code is; inlined in the page's style unescaped.

import { join } from "node:path";
import { readPlainFile, recordsDir } from "../../_files.mjs";
import { cutAt } from "../../_text.mjs";

const MAX_FILE = 8 * 1024 * 1024;     // a file larger than this is not read
const MAX_RECORD = 200 * 1024;        // ARCHITECTURE.md, source characters kept
const METRICS_CAP = 1024 * 1024;      // a metrics table is a few rows; past this it is not read
const TOKENS_CAP = 64 * 1024;         // a token file is a few dozen lines; past this it is not read

// Each reader takes `records`, the project's docs/roadkeeper folder, or null when it is none to read.

// The file `name` in `records` as a plain file of at most `cap` bytes, or null when absent, refused or none to read.
const readRecordsFile = (records, name, cap = MAX_FILE) => (records ? readPlainFile(join(records, name), cap) : null);

// docs/roadkeeper/metrics.md, the metrics table's text, or "" when absent or over METRICS_CAP.
function readMetrics(records) {
  const text = readRecordsFile(records, "metrics.md", METRICS_CAP);
  return text || "";
}

// docs/roadkeeper/ARCHITECTURE.md, the system's shape, cut to MAX_RECORD. Absent → no tab, and nothing said: the file is
// optional. A linked docs/ or docs/roadkeeper/ is not walked.
function parseArchitecture(records) {
  const name = "ARCHITECTURE.md";
  const raw = readRecordsFile(records, name);
  return { file: `docs/roadkeeper/${name}`, text: raw == null ? null : cutAt(raw, MAX_RECORD) };
}

// docs/roadkeeper/one-pager.md, what the project is, or null when absent or refused, and nothing said: the file is optional.
const readOnePagerIfAny = (records) => readRecordsFile(records, "one-pager.md");

const sourcesIn = (records) => ({ metrics: readMetrics(records) });

// The road model's sources: { metrics }.
export const modelSources = (root) => sourcesIn(recordsDir(root));

// The page's sources: the road model's, `architecture`, the Architecture tab's text, and `onePager`, the one-pager's.
export const pageSources = (root) => {
  const records = recordsDir(root);
  return { ...sourcesIn(records), architecture: parseArchitecture(records), onePager: readOnePagerIfAny(records) };
};

// The token file at `path`: { path, css }, `css` null when it cannot be read.
export const pageTokens = (path) => ({ path, css: readPlainFile(path, TOKENS_CAP) });
