// @level infrastructure
// Roadkeeper — Claude Code's transcript folder for a project and the transcripts in it: each session's, at the
// folder's top, and each agent's, in its session's subagents/ folder beside the description file Claude Code keeps.

import { lstatSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { isPlainDir, lexists, readPlainFile, realPath } from "../../_files.mjs";
import { mainCheckout } from "../../_git.mjs";

const META_CAP = 64 * 1024; // bytes of an agent's description file read: Claude Code's are under 1 KB
const SESSION_NAME = 8; // characters of a session's id naming its row
const TRANSCRIPT = ".jsonl"; // a transcript's ending
const META = ".meta.json"; // the description file's ending, beside the agent's transcript

// The project's transcript folder: under Claude Code's config folder (CLAUDE_CONFIG_DIR in `env`, else ~/.claude),
// projects/ and the path of the project's main checkout, every character but a letter or a digit as `-`, as Claude
// Code names it. { folder }, or { refused } when it is missing or reached from the config folder through a link.
export function findTranscriptFolder(root, env) {
  const config = env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  const project = realPath(mainCheckout(root) || root);
  const folder = join(config, "projects", project.replace(/[^A-Za-z0-9]/g, "-"));
  if (!lexists(folder)) return { refused: `no transcript folder at ${folder}` };
  if (!isPlainDir(config, folder)) return { refused: `the transcript folder ${folder} is reached through a link, or is no folder` };
  return { folder };
}

// When the file at `path` was last written, in milliseconds; null when it cannot be read.
export const readLastWritten = (path) => { try { return lstatSync(path).mtimeMs; } catch { return null; } };

// the entries of a folder: { entries, isUnlisted }, none and isUnlisted when it cannot be listed
function listEntries(folder) {
  try {
    return { entries: readdirSync(folder, { withFileTypes: true }), isUnlisted: false };
  } catch {
    return { entries: [], isUnlisted: true };
  }
}

// the parsed JSON of a description file's text, or null when it is none
const parseJson = (text) => { try { return JSON.parse(text); } catch { return null; } };

// The description in an agent's description file: { description, isUnreadable }, description null when there is
// none, isUnreadable when the file is there but cannot be read (a link, over the cap) or is no JSON.
function readDescription(transcript) {
  const meta = transcript.slice(0, -TRANSCRIPT.length) + META;
  if (!lexists(meta)) return { description: null, isUnreadable: false };
  const text = readPlainFile(meta, META_CAP);
  const parsed = text === null ? null : parseJson(text);
  const said = parsed === null ? null : parsed.description;
  const hasDescription = typeof said === "string" && said.trim() !== "";
  return { description: hasDescription ? said : null, isUnreadable: parsed === null };
}

// A transcript's run's name: { name, isUnreadable }, name a session's id, cut; an agent's description, else its file's
// name; isUnreadable when its description file could not be read.
export function nameRun({ path, isSession }) {
  const file = basename(path, TRANSCRIPT);
  if (isSession) return { name: `session ${file.slice(0, SESSION_NAME)}`, isUnreadable: false };
  const { description, isUnreadable } = readDescription(path);
  return { name: description || file, isUnreadable };
}

// whether the path is a link, a junction included; false when nothing is there
const isLinkAt = (path) => lexists(path) && lstatSync(path).isSymbolicLink();

// each agent's transcript in a session's folder, { path, isSession }, the links not read in their place (the
// subagents folder, or a transcript in it) and whether the subagents folder could not be listed:
// { transcripts, links, isUnlisted }
function listAgentTranscripts(sessionFolder) {
  const folder = join(sessionFolder, "subagents");
  if (!isPlainDir(sessionFolder, folder)) return { transcripts: [], links: isLinkAt(folder) ? 1 : 0, isUnlisted: false };
  const { entries, isUnlisted } = listEntries(folder);
  const named = entries.filter((e) => e.name.startsWith("agent-") && e.name.endsWith(TRANSCRIPT));
  const transcripts = named.filter((e) => e.isFile()).map((e) => ({ path: join(folder, e.name), isSession: false }));
  return { transcripts, links: named.filter((e) => e.isSymbolicLink()).length, isUnlisted };
}

// Each transcript in `folder`, each session's then its agents', { path, isSession }, the count of links not read in
// the folder (a link at its top, a session's file or folder, or one in a session's folder) and of subagents folders
// that could not be listed: { transcripts, links, unlisted }; { refused } when `folder` itself cannot be listed.
export function listTranscripts(folder) {
  const { entries, isUnlisted } = listEntries(folder);
  if (isUnlisted) return { refused: `the transcript folder ${folder} could not be listed` };
  const sessions = entries.filter((e) => e.isFile() && e.name.endsWith(TRANSCRIPT))
    .map((e) => ({ path: join(folder, e.name), isSession: true }));
  const agents = entries.filter((e) => e.isDirectory()).map((e) => listAgentTranscripts(join(folder, e.name)));
  const links = entries.filter((e) => e.isSymbolicLink()).length + agents.reduce((n, a) => n + a.links, 0);
  const unlisted = agents.filter((a) => a.isUnlisted).length;
  return { transcripts: [...sessions, ...agents.flatMap((a) => a.transcripts)], links, unlisted };
}
