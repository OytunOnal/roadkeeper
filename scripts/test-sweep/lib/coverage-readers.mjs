// @level infrastructure
// Roadkeeper — the coverage readers every test sweep run is started under, each { name, makeRunFolder(folder),
// read(folder, project) }: `makeRunFolder` makes `folder`, laying there any file the reader needs, and returns the
// variables making a run write its data there, `read` that data read back as the lines of the project's code it
// reached, { reached, skipped, unread } (node-coverage.mjs's),
// `unread` what a card says when the reader could not read its code, a sentence or { language, unlisted }, its folder
// unlisted (cards-page.mjs words it), else absent or null. A reader for another
// language's code joins this list.

import { nodeCoverage } from "./node-coverage.mjs";
import { pythonCoverage } from "./python-coverage.mjs";

// node processes, in either stack: every Roadkeeper project runs some; Python processes, read by the project's own
// coverage when its Python has one
export const COVERAGE_READERS = [nodeCoverage, pythonCoverage];
