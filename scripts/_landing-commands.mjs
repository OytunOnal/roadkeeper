// @level infrastructure
// Roadkeeper — the commands that land, as the merge guard reads them (scripts/merge-guard.mjs): `git push`, `gh pr merge`
// and `gh api` read by their options, and git and gh asked what they land and where git acts.

import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { OBJECT_HASH, findProgram, git } from "./_git.mjs";
import { repoRoot } from "./_hook.mjs";
import { landsOn } from "./_judge-landing.mjs";
import { GIT, gitCommand, prefixAssignments, readProgram } from "./_program-options.mjs";
import { splitWords } from "./_shell.mjs";

const GH = /^gh(?:\.exe)?$/i; // gh's name as a shell runs it
const GH_TIMEOUT = 20000; // milliseconds gh may take to say a pull request's head: one request to GitHub
const GH_OUTPUT_MAX = 64 * 1024; // bytes of gh's answer read: one field of JSON
const TAGS_MAX = 1000; // tags one push may carry and be judged: a project's releases, with room
const PUSH_VALUED = new Set(["--repo", "-o", "--push-option", "--receive-pack", "--exec"]); // push options whose value is the next word
const MERGE_VALUED = new Set(["-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email", "--match-head-commit", "-R", "--repo"]); // gh pr merge's options whose value is the next word
const API_VALUED = new Set(["-X", "--method", "-H", "--header", "-f", "--raw-field", "-F", "--field", "--input", "-q", "--jq", "-t", "--template", "--hostname", "-p", "--preview", "--cache"]); // gh api's options whose value is the next word
const API_BODY = ["-f", "--raw-field", "-F", "--field", "--input"]; // gh api's options that send a body, a POST unless -X says
const MERGE_PATH = /^\/?repos\/([^/?#]+)\/([^/?#]+)\/pulls\/(\d+)\/merge\/?(?:[?#].*)?$/; // the REST path that merges a pull request
const CONFIG_ASSIGNED = /^GIT_CONFIG_(?:KEY_\d+|PARAMETERS)$/; // the variables that hand git settings
const NOTHING_PUSHED = ["--delete", "-d", "--dry-run", "-n"]; // push options under which no commit lands
const BULK = ["--all", "--branches", "--mirror", "--tags"]; // push options that name the refs in place of refspecs

// A push's words read: { remote, refspecs, flags }; `flags`, the options' names, a short cluster's letter by letter.
function readPush(words) {
  const { options, positional } = splitWords(words, PUSH_VALUED);
  const flags = new Set();
  for (const [name] of options) {
    if (name.startsWith("--")) flags.add(name);
    else for (const letter of name.slice(1)) flags.add("-" + letter);
  }
  const repo = options.find(([name]) => name === "--repo");
  return { remote: positional[0] ?? repo?.[1] ?? null, refspecs: positional.slice(1), flags };
}

// `gh pr merge`'s words read as `gh pr view`'s arguments for the same pull request; null when they merge nothing.
function readMerge(words) {
  const { options, positional } = splitWords(words, MERGE_VALUED);
  const names = new Set(options.map(([name]) => name));
  if (["--disable-auto", "--help", "-h"].some((name) => names.has(name))) return null;
  const repo = options.find(([name]) => name === "-R" || name === "--repo");
  return [...(repo ? ["--repo", repo[1]] : []), "--json", "headRefOid", "--", ...positional.slice(0, 1)];
}

// `gh api`'s words read as `gh pr view`'s arguments for the pull request its merge path names; null when it names none
// or reads it with a GET. `{owner}` and `{repo}` leave the repository to gh, as gh api does.
function readApiMerge(words) {
  const { options, positional } = splitWords(words, API_VALUED);
  const path = MERGE_PATH.exec(positional[0] ?? "");
  if (!path) return null;
  const method = options.find(([name]) => name === "-X" || name === "--method")?.[1];
  const sendsBody = options.some(([name]) => API_BODY.includes(name));
  if (method ? method.toUpperCase() === "GET" : !sendsBody) return null;
  const [, owner, repo, pr] = path;
  const host = options.find(([name]) => name === "--hostname")?.[1];
  const named = owner !== "{owner}" && repo !== "{repo}" ? [`${host ? host + "/" : ""}${owner}/${repo}`] : [];
  return [...(named.length ? ["--repo", ...named] : []), "--json", "headRefOid", "--", pr];
}

// a GIT_CONFIG_* assignment before the command that names an alias
const aliasAssigned = (assigned) => assigned.some(([name, value]) => CONFIG_ASSIGNED.test(name) && /alias\./i.test(value));

// A simple command's landing: { merge } (gh pr view's arguments), { push, at, place }, { alias, at, place }, or null when
// it lands nothing.
export function landingCommand(words) {
  const { name, args: rest } = readProgram(words);
  if (GH.test(name)) {
    const merge = rest[0] === "pr" && rest[1] === "merge" ? readMerge(rest.slice(2)) : rest[0] === "api" && readApiMerge(rest.slice(1));
    return merge ? { merge } : null;
  }
  if (!GIT.test(name)) return null;
  const assigned = prefixAssignments(words);
  const { at, place, alias, command, rest: pushWords } = gitCommand(rest);
  const fromEnv = new Map(assigned);
  const where = { gitDir: place.gitDir ?? fromEnv.get("GIT_DIR"), workTree: place.workTree ?? fromEnv.get("GIT_WORK_TREE") };
  if (alias || aliasAssigned(assigned)) return { alias: true, at, place: where };
  return command === "push" ? { push: readPush(pushWords), at, place: where } : null;
}

// One git answer about the repository `repo` ({ cwd, opts }: the folder git runs in and its --git-dir and --work-tree),
// or "" when git fails.
const ask = (repo, args) => { try { return git([...repo.opts, ...args], repo.cwd); } catch { return ""; } };

// The branch checked out in the repository `repo` (placeOf's), or null when none is.
export const currentBranch = (repo) => ask(repo, ["symbolic-ref", "--short", "-q", "HEAD"]) || null;

// The commit a name resolves to, a full hash; "" when none. A name read as an option resolves to none.
const commitOf = (repo, name) => (name.startsWith("-") ? "" : ask(repo, ["rev-parse", "--verify", "-q", `${name}^{commit}`]));

// A push destination as git expands a short one: `heads/x` and `tags/x` under refs/.
const expanded = (destination) => (/^(?:heads|tags)\//.test(destination) ? `refs/${destination}` : destination);

// The source of a refspec whose destination lands (landsOn); null for a deletion (`:dst`) or one landing elsewhere.
function specSource(repo, spec, home) {
  const plain = spec.replace(/^\+/, "");
  const colon = plain.indexOf(":");
  const source = colon < 0 ? plain : plain.slice(0, colon);
  if (!source || source.startsWith("-")) return null;
  const sourceRef = ask(repo, ["rev-parse", "--symbolic-full-name", source]);
  const destination = colon < 0 ? sourceRef : plain.slice(colon + 1);
  return destination && landsOn(expanded(destination), sourceRef, home) ? source : null;
}

// A push's refspecs, `tag <name>` read as the tag's ref.
function refspecList(refspecs) {
  const out = [];
  for (let k = 0; k < refspecs.length; k++) {
    const named = refspecs[k] === "tag" && k + 1 < refspecs.length;
    out.push(named ? `refs/tags/${refspecs[++k]}` : refspecs[k]);
  }
  return out;
}

// The tags a bulk push carries that the remote's default branch does not hold, as objects; null over TAGS_MAX.
function bulkTags(repo, remoteRef) {
  const notHeld = remoteRef ? [`--no-merged=${remoteRef}`] : [];
  const out = ask(repo, ["for-each-ref", `--count=${TAGS_MAX + 1}`, "--format=%(objectname)", ...notHeld, "refs/tags"]);
  const tags = out.split("\n").filter(Boolean);
  return tags.length > TAGS_MAX ? null : tags;
}

// The current branch, when a push with no refspec sends it to the default branch.
function currentSource(repo, { current, home }) {
  if (!current) return [];
  const own = `refs/heads/${current}`;
  const destination = ask(repo, ["for-each-ref", "--format=%(push:remoteref)", own]) || own;
  return landsOn(expanded(destination), own, home) ? [own] : [];
}

// The names of what a push lands on the default branch or as tags, git resolving each; null when it carries more tags
// than TAGS_MAX. `branch`: { current, home, remoteRef }, remoteRef the remote's default branch's remote-tracking ref.
function pushSources(repo, push, branch) {
  const { flags } = push;
  if (NOTHING_PUSHED.some((f) => flags.has(f))) return [];
  const specs = refspecList(push.refspecs);
  const sources = specs.map((spec) => specSource(repo, spec, branch.home)).filter(Boolean);
  if (["--all", "--branches", "--mirror"].some((f) => flags.has(f))) sources.push(`refs/heads/${branch.home}`);
  if (flags.has("--tags") || flags.has("--mirror")) {
    const tags = bulkTags(repo, branch.remoteRef);
    if (!tags) return null;
    sources.push(...tags);
  }
  const bulk = BULK.some((f) => flags.has(f));
  return specs.length || bulk ? sources : currentSource(repo, branch);
}

// The pull request's head commit, a full hash, as gh says it; null when gh cannot say.
function prHead(root, viewArgs) {
  const gh = findProgram("gh");
  if (!gh) return null;
  let head;
  try {
    const out = execFileSync(gh, ["pr", "view", ...viewArgs], { cwd: root, encoding: "utf8", timeout: GH_TIMEOUT,
      maxBuffer: GH_OUTPUT_MAX, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    head = JSON.parse(out).headRefOid;
  } catch { return null; }
  return typeof head === "string" && OBJECT_HASH.test(head) ? head : null;
}

// The commits a landing command lands: { commits }, or { refusal } when they cannot be said. `place`: { root, repo }.
export function landedCommits(place, found, branch) {
  if (found.merge) {
    const head = prHead(place.root, found.merge);
    return head ? { commits: [head] } : { refusal: "gh could not say the pull request's head commit; nothing is merged that is not green" };
  }
  const sources = pushSources(place.repo, found.push, branch);
  if (!sources) return { refusal: `the push carries more than ${TAGS_MAX} tags; push each by name` };
  return { commits: [...new Set(sources.map((name) => commitOf(place.repo, name)).filter(Boolean))] };
}

// The main checkout of the repository git acts on for `repo`, or null when it is none's (a bare repository).
function mainOf(repo) {
  const common = ask(repo, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return common && basename(common) === ".git" ? dirname(common) : null;
}

// Where a git command acts, run from the folder `dir` with `where` ({ gitDir, workTree }, from its options or
// assignments): { root, repo }; `root` the worktree whose commands file holds it (falsy: none): the work tree named,
// else the main checkout of the git directory named, else the worktree holding `dir`; `repo` what git is asked in.
export function placeOf(dir, where = {}) {
  const gitDir = where.gitDir && resolve(dir, where.gitDir);
  const workTree = where.workTree && resolve(dir, where.workTree);
  const opts = [...(gitDir ? ["--git-dir", gitDir] : []), ...(workTree ? ["--work-tree", workTree] : [])];
  const repo = { cwd: dir, opts };
  const root = (workTree && repoRoot(workTree)) || (gitDir ? mainOf(repo) : repoRoot(dir));
  return { root, repo };
}
