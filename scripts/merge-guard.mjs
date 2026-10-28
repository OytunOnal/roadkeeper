#!/usr/bin/env node
// @level main
// Roadkeeper — the merge guard (PreToolUse hook on Bash and PowerShell, scripts/hooks.json): nothing lands on the default
// branch, nor as a tag, that is not green.
//
// Among a command line's simple commands (`shellCommands`, scripts/_shell.mjs), each read past the programs that run
// the next word (`command`, `env`, …), catches `gh pr merge`, a `gh api` call on a pull request's merge path that is no
// GET, and a `git push` landing on the default branch (what origin/HEAD names, else main, else master) or a tag: a
// destination git expands there (`heads/<branch>`, `tags/<tag>`) too. Refuses (exit 2, one line on stderr: fixed words,
// the commit's hash and the green's command) when a commit that lands is not green: its tree holds no green stamp and
// differs from every stamped tree in a file the commands file's readByNothing leaves out (scripts/project-tools/,
// `landingRefusal`). Refuses, in fixed words, a git command given an alias on its command line (`-c alias.…`,
// `--config-env alias.…`, a GIT_CONFIG_* assignment), which can run a push under another name.
// What lands: for `gh pr merge [<pr>] [-R <repo>]` and `gh api …/pulls/<pr>/merge`, the pull request's head, which
// `gh pr view --json headRefOid` says; for `git push`, each refspec's source whose destination is the default branch or
// a tag (`tag <name>` too), with no refspec the current branch where it pushes to the default one, `--all`'s default
// branch, `--tags`' and `--mirror`'s tags. The repository is the one git acts on: under `-C`, `--git-dir`,
// `--work-tree`, and a GIT_DIR or GIT_WORK_TREE assignment before it.
// Passes: a commit the remote's default branch already holds, as its remote-tracking ref says; a push of any other
// branch; a deletion; `--dry-run`; `gh pr merge --disable-auto`. Passes, saying nothing, where the command's repository
// holds no Roadkeeper docs folder or no commands file; a commands file it cannot read refuses, naming why. Not read, and so
// passed: a push or merge inside an evaluated string (`eval`, `bash -c`, `sh -c`, `Invoke-Expression`), a variable or
// a script; the guard catches a session's mistake, not a session hiding a push (docs/roadkeeper/threats.md, row 12).
// Only reads: its call through `readShellCall` (_hook.mjs), which bounds the input; git and gh, each an argument list
// found on the PATH's absolute folders. Runs no green and writes nothing. A command it cannot read lets it pass, said on
// stderr.

import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { OBJECT_HASH, findProgram, git } from "./_git.mjs";
import { branches, hookMessage, letPass, readShellCall, repoRoot } from "./_hook.mjs";
import { GIT, prefixAssignments, programName, programWords, shellCommands } from "./_shell.mjs";

const GH = /^gh(?:\.exe)?$/i; // gh's name as a shell runs it
const GH_TIMEOUT = 20000; // milliseconds gh may take to say a pull request's head: one request to GitHub
const GH_OUTPUT_MAX = 64 * 1024; // bytes of gh's answer read: one field of JSON
const TAGS_MAX = 1000; // tags one push may carry and be judged: a project's releases, with room
const GIT_VALUED = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix"]); // git's options before its command whose value is the next word
const PUSH_VALUED = new Set(["--repo", "-o", "--push-option", "--receive-pack", "--exec"]); // push options whose value is the next word
const MERGE_VALUED = new Set(["-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email", "--match-head-commit", "-R", "--repo"]); // gh pr merge's options whose value is the next word
const API_VALUED = new Set(["-X", "--method", "-H", "--header", "-f", "--raw-field", "-F", "--field", "--input", "-q", "--jq", "-t", "--template", "--hostname", "-p", "--preview", "--cache"]); // gh api's options whose value is the next word
const API_BODY = ["-f", "--raw-field", "-F", "--field", "--input"]; // gh api's options that send a body, a POST unless -X says
const MERGE_PATH = /^\/?repos\/([^/?#]+)\/([^/?#]+)\/pulls\/(\d+)\/merge\/?(?:[?#].*)?$/; // the REST path that merges a pull request
const ALIAS = /^alias\./i; // a git setting naming an alias
const CONFIG_ASSIGNED = /^GIT_CONFIG_(?:KEY_\d+|PARAMETERS)$/; // the variables that hand git settings
const NOTHING_PUSHED = ["--delete", "-d", "--dry-run", "-n"]; // push options under which no commit lands
const BULK = ["--all", "--branches", "--mirror", "--tags"]; // push options that name the refs in place of refspecs
const ALIAS_REFUSAL = "a git command given an alias on its command line can push under another name; run git's own command"; // fixed words

// A command's words after its program: { options, positional }; each option [name, value], its value attached or, for a
// name in `valued`, the next word.
function splitWords(words, valued) {
  const options = [];
  const positional = [];
  for (let k = 0; k < words.length; k++) {
    const w = words[k];
    if (w === "--") { positional.push(...words.slice(k + 1)); break; }
    if (!w.startsWith("-") || w === "-") { positional.push(w); continue; }
    const [name, ...value] = w.split("=");
    if (valued.has(name) && !value.length) options.push([name, words[++k] ?? ""]);
    else options.push([name, value.join("=")]);
  }
  return { options, positional };
}

// A git command line's words after git: { at, place, alias, command, rest }: the -C folders in order; `place`, its
// --git-dir and --work-tree; whether a -c or --config-env setting names an alias; git's command and its words.
function gitCommand(words) {
  const at = [];
  const place = {};
  let alias = false;
  let k = 0;
  for (; k < words.length && words[k].startsWith("-"); k++) {
    const [name, ...attached] = words[k].split("=");
    let value = attached.join("=");
    if (!attached.length && GIT_VALUED.has(name)) value = words[++k] ?? "";
    if (name === "-C") at.push(value);
    if (name === "--git-dir") place.gitDir = value;
    if (name === "--work-tree") place.workTree = value;
    if (name === "-c" || name === "--config-env") alias ||= ALIAS.test(value);
  }
  return { at, place, alias, command: words[k], rest: words.slice(k + 1) };
}

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
function landingCommand(words) {
  const [program, ...rest] = programWords(words, { wrappers: true });
  const name = programName(program);
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

// The commit a name resolves to, a full hash; "" when none. A name read as an option resolves to none.
const commitOf = (repo, name) => (name.startsWith("-") ? "" : ask(repo, ["rev-parse", "--verify", "-q", `${name}^{commit}`]));

// A push destination as git expands a short one: `heads/x` and `tags/x` under refs/.
const expanded = (destination) => (/^(?:heads|tags)\//.test(destination) ? `refs/${destination}` : destination);

// Whether a push's destination ref lands on the default branch `home` or as a tag; `sourceRef`, its source's full name.
function landsOn(destination, sourceRef, home) {
  const full = expanded(destination);
  const onHome = full === home || full === `refs/heads/${home}`;
  const tagByName = !full.startsWith("refs/") && sourceRef.startsWith("refs/tags/"); // git names it as its source
  return onHome || full.startsWith("refs/tags/") || tagByName;
}

// The source of a refspec whose destination lands (landsOn); null for a deletion (`:dst`) or one landing elsewhere.
function specSource(repo, spec, home) {
  const plain = spec.replace(/^\+/, "");
  const colon = plain.indexOf(":");
  const source = colon < 0 ? plain : plain.slice(0, colon);
  if (!source || source.startsWith("-")) return null;
  const sourceRef = ask(repo, ["rev-parse", "--symbolic-full-name", source]);
  const destination = colon < 0 ? sourceRef : plain.slice(colon + 1);
  return destination && landsOn(destination, sourceRef, home) ? source : null;
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
  return landsOn(destination, own, home) ? [own] : [];
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
function landedCommits(place, found, branch) {
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
function placeOf(dir, where = {}) {
  const gitDir = where.gitDir && resolve(dir, where.gitDir);
  const workTree = where.workTree && resolve(dir, where.workTree);
  const opts = [...(gitDir ? ["--git-dir", gitDir] : []), ...(workTree ? ["--work-tree", workTree] : [])];
  const repo = { cwd: dir, opts };
  const root = (workTree && repoRoot(workTree)) || (gitDir ? mainOf(repo) : repoRoot(dir));
  return { root, repo };
}

// One landing command judged from the folder `cwd`: its refusal, or null when it passes.
function judged(tools, found, cwd) {
  const place = placeOf((found.at ?? []).reduce((dir, to) => resolve(dir, to), cwd), found.place);
  const { root } = place;
  const rules = root ? tools.landingRules(root) : null;
  if (!rules || rules.refusal) return rules?.refusal ?? null;
  if (found.alias) return ALIAS_REFUSAL;
  const remote = found.push?.remote ?? "origin";
  const { home } = branches(root);
  const current = ask(place.repo, ["symbolic-ref", "--short", "-q", "HEAD"]) || null;
  const branch = { current, home, remoteRef: tools.remoteHome(root, remote, home) };
  const { commits, refusal } = landedCommits(place, found, branch);
  return refusal ?? tools.landingRefusal(root, { remote, home, commits, patterns: rules.patterns });
}

async function main() {
  const call = readShellCall("merge-guard");
  if (!call) return 0;
  let found;
  try {
    found = shellCommands(call.command, { powershell: call.tool === "PowerShell" }).map((s) => landingCommand(s.words)).filter(Boolean);
  } catch (e) { return letPass("merge-guard", `the command could not be read (${e.name})`); }
  if (!found.length) return 0;
  const { cwd } = call;
  const tools = await import("./project-tools/project-tools.mjs"); // loaded only for a landing: every other call stays fast
  for (const one of found) {
    const refusal = judged(tools, one, cwd);
    if (refusal) { process.stderr.write(hookMessage("merge-guard", refusal) + "\n"); return 2; }
  }
  return 0;
}

process.exitCode = await main();
