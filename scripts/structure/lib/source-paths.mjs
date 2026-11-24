// @level domain
// Roadkeeper — the source-path helpers: which files are read as code. Matching paths is path-match.mjs's.

// a script's endings: JavaScript and TypeScript, as dependency-cruiser and the compiler parse them, and Astro
const SCRIPT_ENDINGS = "[cm]?[jt]s|[jt]sx|astro";
// the files the script parser takes
const SCRIPT = new RegExp(`\\.(?:${SCRIPT_ENDINGS})$`);
// the files read as code: the scripts and Python
export const SOURCE = new RegExp(`\\.(?:${SCRIPT_ENDINGS}|py)$`);
export const isCodeEdge =(e) => SOURCE.test(e.from) && SOURCE.test(e.to); // the only edges the check rules and the tab draws
export const isScript = (file) => SCRIPT.test(file);
export const isAstro = (file) => file.endsWith(".astro");
export const isPython = (file) => file.endsWith(".py");
