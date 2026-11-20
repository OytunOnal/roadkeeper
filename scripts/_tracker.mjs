// @level infrastructure
// Roadkeeper — the tracker: read through `gh`, cleaned into one snapshot shape, kept in docs/roadkeeper/issues.json; its
// milestones renamed through `gh`. A read takes the issues, their parents, the milestones, and the timeline of each open
// issue in flight wearing `waiting-on-you`, for the day the label was last added. A list of issues or milestones that
// came back incomplete fails the read (checkIssuesWhole, checkMilestonesWhole); a timeline that did leaves that issue's
// day unread. The session line's read (readTrackerForCounts) takes only what the line counts, within the hook's time,
// and writes nothing.
//
// One snapshot rule: offline, after `gh` fails, and for the previous read that dates `seenAt`, the tree's own snapshot
// is read, else, in a linked worktree, its main checkout's (scripts/_git.mjs); a live read writes the tree's own,
// whole, unless a newer read is on disk. `gh` is found and run by scripts/_git.mjs's rule for an outside program; no
// `gh` found reads as `gh` failing. Every field of the snapshot is typed and cut, whether it came from `gh` a moment
// ago or from a file anyone could have edited.

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { todayLocal } from "./_clock.mjs";
import { insideRoot, readPlainFile, replaceFile, recordsDir } from "./_files.mjs";
import { findProgram, mainCheckout } from "./_git.mjs";
import { WAITING_LABEL, inFlightWaitingOnYou } from "./_milestones.mjs";
import { cutAt, isCalendarDate } from "./_text.mjs";
import { FAILURE_KIND } from "./_tracker-failure-kinds.mjs";

export const SNAPSHOT = "docs/roadkeeper/issues.json";
const SNAPSHOT_CAP = 64 * 1024 * 1024; // bytes of a snapshot read back
const GH_TIMEOUT = 60000;              // milliseconds one `gh` call may take
// bounds on a stranger's tracker
const MAX_ISSUES = 2000;               // issues read
const MAX_MILESTONES = 1000;           // milestones read
const MAX_TITLE = 300;                 // characters of a title
const MAX_BODY = 20000;                // characters of an issue or milestone body
const MAX_COMMENTS = 20;               // the last comments of an issue
const MAX_COMMENT = 4000;              // characters of a comment
const GH_OUTPUT = 256 * 1024 * 1024;   // bytes one `gh` call may print: 2000 issues with their bodies and comments fit

// The real runner: one `gh` call within the time it is given, `gh` found by findProgram (scripts/_git.mjs). A test
// hands readTracker an in-memory one instead.
function gh(args, root, left) {
  const program = findProgram("gh");
  if (!program) throw Object.assign(new Error("gh is not on the PATH"), { code: "ENOENT" });
  return execFileSync(program, args, {
    cwd: root, encoding: "utf8", timeout: left, maxBuffer: GH_OUTPUT,
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
}

// the first line `gh` said about its failure, cut
const ghError = (e) => {
  const said = String((e && (e.stderr || e.message)) || "gh failed").split("\n").map((l) => l.trim()).find(Boolean) || "gh failed";
  return cutAt(said, 200);
};

const GH_AUTH_EXIT = 4; // gh's exit when it holds no login
// what gh says when it is refused its login, or holds none
const SIGNED_OUT = /gh auth login|\bHTTP 401\b/;
// what gh says when no answer came: a server's error answer, or a connection failed or gh's own wait timed out
const NO_ANSWER = /\bHTTP 5\d\d\b|error connecting to|dial tcp|no such host|connection (?:refused|reset)|i\/o timeout|TLS handshake timeout|Client\.Timeout|deadline exceeded/i;
// what gh says when GitHub limits its reads: HTTP 429, and a 403's "API rate limit exceeded" or "secondary rate limit",
// as gh's client ("HTTP 403: ...") and `gh api` ("gh: ... (HTTP 403)") print them; GraphQL's "API rate limit already
// exceeded"; gh's own "GitHub API rate limit exceeded" and "rate limited"
const RATE_LIMITED = /\bHTTP 429\b|\brate limit(?:ed)?\b/i;

// The kind of a failed read (FAILURE_KIND): the kind an incomplete list was thrown with (incomplete); else, from what
// `gh` threw, not signed in, gh missing (no program to run), out of time (the read stopped waiting: ETIMEDOUT, from its
// own budget or a call's timeout), rate limited, no answer (a server's error answer, a failed connection, gh's own
// timeout), or other.
function classifyFailure(error) {
  const thrown = error || {};
  if (Object.values(FAILURE_KIND).includes(thrown.kind)) return thrown.kind;
  const said = `${thrown.stderr || ""}\n${thrown.message || ""}`;
  if (thrown.status === GH_AUTH_EXIT || SIGNED_OUT.test(said)) return FAILURE_KIND.notSignedIn;
  if (thrown.code === "ENOENT") return FAILURE_KIND.ghMissing;
  if (thrown.code === "ETIMEDOUT") return FAILURE_KIND.outOfTime;
  if (RATE_LIMITED.test(said)) return FAILURE_KIND.rateLimited;
  return NO_ANSWER.test(said) ? FAILURE_KIND.noAnswer : FAILURE_KIND.other;
}

const PER_PAGE = 100; // the most a REST list gives in one page
const MAX_EVENTS = 1000; // events of an issue's timeline read, ten pages

// The last time `waiting-on-you` was added to issue `n`, from its timeline's `labeled` events read by `upTo`, or null
// when the read fails or finds none: its card then claims no age (road-model.mjs). A page served short reads as the
// end; one cut short that still holds an older `labeled` event cannot be told from a whole one, and that older day is
// taken: nothing GitHub sends tells them apart.
function labelledWaitingOn(upTo, name, n) {
  try {
    const added = upTo(`repos/${name}/issues/${n}/timeline`, MAX_EVENTS).items
      .filter((e) => e && e.event === "labeled" && e.label && e.label.name === WAITING_LABEL)
      .map((e) => iso(e.created_at)).filter(Boolean).sort();
    return added.length ? added[added.length - 1] : null;
  } catch { return null; }
}

// Each issue `gh` lists that is in flight wearing `waiting-on-you`, read in the snapshot's shape (cleanSnapshot), by
// number to the day the label was last added (labelledWaitingOn), one timeline read each.
function waitingSinceOf(issues, upTo, name) {
  const waits = cleanSnapshot({ issues }).issues.filter(inFlightWaitingOnYou);
  return new Map(waits.map((i) => [i.number, labelledWaitingOn(upTo, name, i.number)]));
}

// An issue's parent number from its address, the REST list's `parent_issue_url` (`…/repos/<owner>/<repo>/issues/N`) or
// `gh issue list`'s parent `url` (`…/<owner>/<repo>/issues/N`), when the parent is an issue of this repository; else
// null.
function parentOf(url, name) {
  const m = /\/([^/\s]+\/[^/\s]+)\/issues\/(\d{1,9})$/.exec(typeof url === "string" ? cutAt(url, 500) : "");
  return m && m[1].toLowerCase() === name.toLowerCase() ? Number(m[2]) : null;
}

// An incomplete list's failure: the read fails as `gh` failing does, its kind (FAILURE_KIND) and its line said.
const makeIncompleteError = (kind, said) => Object.assign(new Error(said), { kind });

// A REST list's numbered thing, and whether `list` ({ items, capped }) lacks number `n`: a list cut at its cap is whole
// as far as the snapshot reads (MAX_ISSUES, MAX_MILESTONES).
const numberOf = (x) => int(x && x.number);
const isLacking = (list, n) => !list.capped && !list.items.some((x) => numberOf(x) === n);

// Throws when `restIssues`, the REST list of issues, came back incomplete: short of its cap without an issue
// `gh issue list` gave.
function checkIssuesWhole(issues, restIssues) {
  const listed = issues.map(numberOf).filter(Boolean);
  const lacked = listed.filter((n) => isLacking(restIssues, n));
  if (lacked.length) {
    throw makeIncompleteError(FAILURE_KIND.incompleteIssues,
      `GitHub's list of issues lacks ${lacked.length} of the ${listed.length} issues gh listed, #${Math.min(...lacked)} first`);
  }
}

// Throws when `milestones`, the REST list of milestones, came back incomplete: short of its cap without a milestone an
// issue names.
function checkMilestonesWhole(issues, milestones) {
  const named = issues.find((i) => i && numberOf(i.milestone) && isLacking(milestones, numberOf(i.milestone)));
  if (named) {
    throw makeIncompleteError(FAILURE_KIND.incompleteMilestones,
      `GitHub's list of milestones lacks milestone ${numberOf(named.milestone)}, which #${numberOf(named)} names`);
  }
}

// A read started within `until`: { fetched, name, url, call, upTo }, its time, the repository `gh` names and its
// address, `call(args)`, one `gh` call given what is left of the read's time, and `upTo(endpoint, cap, isEnough)`, a
// REST list read page by page until a short page, the cap, or a page `isEnough(page)` says ends the read,
// { items, capped }: a tracker larger than the snapshot is never fetched whole.
function startRead(root, until, run) {
  // the read's time is its start: a read started later saw every write before it
  const fetched = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const call = (args) => {
    const left = Math.min(GH_TIMEOUT, until - Date.now());
    if (left <= 0) throw Object.assign(new Error("gh took too long"), { code: "ETIMEDOUT" });
    return run(args, root, left);
  };
  const repo = JSON.parse(call(["repo", "view", "--json", "nameWithOwner,url"]));
  const name = String(repo.nameWithOwner || "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) throw new Error(`gh named no repository: ${cutAt(name, 80)}`);
  const upTo = (endpoint, cap, isEnough = () => false) => {
    const items = [];
    for (let page = 1; items.length < cap; page++) {
      const query = `${endpoint.includes("?") ? "&" : "?"}per_page=${PER_PAGE}&page=${page}`;
      const got = JSON.parse(call(["api", endpoint + query]));
      if (!Array.isArray(got)) break;
      items.push(...got);
      if (got.length < PER_PAGE) break;
      if (isEnough(got)) return { items: items.slice(0, cap), capped: false };
    }
    return { items: items.slice(0, cap), capped: items.length >= cap };
  };
  return { fetched, name, url: repo.url, call, upTo };
}

// the issues `gh issue list` gives in `state` (open, or all), each with `fields` only, by the read's `call` (startRead)
const listIssues = ({ call }, state, fields) =>
  list(JSON.parse(call(["issue", "list", "--state", state, "--limit", String(MAX_ISSUES), "--json", fields])));

// every milestone, by the read's `upTo` (startRead): { items, capped }
const readMilestones = ({ upTo, name }) => upTo(`repos/${name}/milestones?state=all`, MAX_MILESTONES);

// each issue of the REST list's `items` by number to its parent (parentOf)
const restParents = (items, name) => new Map(items.map((i) => [i && i.number, parentOf(i && i.parent_issue_url, name)]));

// The tracker as a read returns it, before any cleaning: `issues`, each with its parent from `parents` (by number) and
// its `waitingSince` (waitingSinceOf), and the milestones' items.
function shapeTracker(read, { issues, parents, milestones }) {
  const since = waitingSinceOf(issues, read.upTo, read.name);
  const shaped = issues.map((i) => ({ ...i, parent: parents.get(i && i.number) || null, waitingSince: since.get(i && i.number) || null }));
  return { fetched: read.fetched, repo: read.name, url: read.url, issues: shaped, milestones };
}

// the tracker as `gh` returns it, before any cleaning, each issue with its parent and its `waitingSince`; each call is
// given what is left of the read's time
function fetchTracker(root, until, run) {
  const read = startRead(root, until, run);
  const issues = listIssues(read, "all", "number,title,state,stateReason,labels,milestone,body,url,createdAt,closedAt,comments");
  // `gh issue list` gives no parent; the REST list does, its pull requests counted against the cap too
  const restIssues = read.upTo(`repos/${read.name}/issues?state=all`, MAX_ISSUES);
  const milestones = readMilestones(read);
  checkIssuesWhole(issues, restIssues);
  checkMilestonesWhole(issues, milestones);
  return shapeTracker(read, { issues, parents: restParents(restIssues.items, read.name), milestones: milestones.items });
}

// The tracker as the session line counts it, before any cleaning: every issue with no body and no comment, the open
// ones with their bodies and their parents from `gh issue list`'s own `parent`, each with its `waitingSince`; the
// milestones. Each call is given what is left of the read's time. No comment is read, and no closed issue's parent:
// the line reads a closed issue's "specced in" comment and its parent only to keep it out of the slices, and a closed
// slice too many never stops a milestone being ready to close; but a milestone whose only issues are closed tickets
// reads as ready.
function fetchTrackerForCounts(root, until, run) {
  const read = startRead(root, until, run);
  const open = listIssues(read, "open", "number,body,parent");
  const bodies = new Map(open.map((i) => [i && i.number, i && i.body]));
  const parents = new Map(open.map((i) => [i && i.number, parentOf(i && i.parent && i.parent.url, read.name)]));
  const issues = listIssues(read, "all", "number,title,state,stateReason,labels,milestone,url,createdAt,closedAt")
    .map((i) => ({ ...i, body: bodies.get(i && i.number) || "" }));
  const milestones = readMilestones(read);
  checkMilestonesWhole(issues, milestones);
  return shapeTracker(read, { issues, parents, milestones: milestones.items });
}

const str = (x, n) => (typeof x === "string" ? cutAt(x, n) : "");
const int = (x) => (Number.isInteger(x) && x > 0 ? x : null);
const iso = (x) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 20) : null);
const day = (x) => (isCalendarDate(x) ? x : null);
const httpUrl = (x) => (typeof x === "string" && /^https:\/\/[^\s"<>]+$/.test(x) ? cutAt(x, 500) : null);
const list = (x) => (Array.isArray(x) ? x : []);
const CLOSE_REASONS = ["COMPLETED", "NOT_PLANNED"]; // how a closed issue closed, as `gh` names it; any other reads as none
const closeReason = (i) => (i.state === "CLOSED" && CLOSE_REASONS.includes(i.stateReason) ? i.stateReason : null);

// The snapshot's one shape. Anything not of its type is dropped; `gh`'s field names and the snapshot's own both read.
function cleanSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  const issues = list(raw.issues).slice(0, MAX_ISSUES).map((i) => ({
    number: int(i && i.number),
    title: str(i && i.title, MAX_TITLE),
    state: i && i.state === "CLOSED" ? "CLOSED" : "OPEN",
    stateReason: i ? closeReason(i) : null,
    labels: list(i && i.labels).map((l) => str(typeof l === "string" ? l : l && l.name, 100)).filter(Boolean),
    milestone: int(i && i.milestone && (typeof i.milestone === "object" ? i.milestone.number : i.milestone)),
    parent: int(i && i.parent),
    body: str(i && i.body, MAX_BODY),
    url: httpUrl(i && i.url),
    createdAt: iso(i && i.createdAt),
    seenAt: day(i && i.seenAt),
    waitingSince: iso(i && i.waitingSince),
    closedAt: iso(i && i.closedAt),
    comments: list(i && i.comments).slice(-MAX_COMMENTS).map((c) => ({
      author: str(c && c.author && typeof c.author === "object" ? c.author.login : c && c.author, 100),
      body: str(c && c.body, MAX_COMMENT),
      createdAt: iso(c && c.createdAt),
    })).filter((c) => c.body),
  })).filter((i) => i.number);
  const milestones = list(raw.milestones).slice(0, MAX_MILESTONES).map((m) => ({
    number: int(m && m.number),
    title: str(m && m.title, MAX_TITLE),
    description: str(m && m.description, MAX_BODY),
    state: m && m.state === "closed" ? "closed" : "open",
    due: iso(m && (m.due_on || m.due)),
    closedAt: iso(m && (m.closed_at || m.closedAt)),
  })).filter((m) => m.number);
  return { fetched: iso(raw.fetched), repo: str(raw.repo, 200), url: httpUrl(raw.url), issues, milestones };
}

// the snapshot file under `root`, cleaned, or null when there is none to read
function readSnapshotFile(root) {
  if (!recordsDir(root)) return null;
  const text = readPlainFile(join(root, SNAPSHOT), SNAPSHOT_CAP);
  if (text == null) return null;
  try { return cleanSnapshot(JSON.parse(text)); } catch { return null; }
}

// The tree's snapshot: its own, else, in a linked worktree, its main checkout's, read under the same guards from the
// main checkout's root. { snap, fromMainCheckout }, snap null when neither is read.
function readTreeSnapshot(root) {
  const own = readSnapshotFile(root);
  if (own) return { snap: own, fromMainCheckout: false };
  const main = mainCheckout(root);
  const mainSnap = main ? readSnapshotFile(main) : null;
  return { snap: mainSnap, fromMainCheckout: mainSnap !== null };
}

// Whether the tree's own snapshot on disk comes from a later read than `snap`, one made beside this one. Reads within
// the same second are equal. A `fetched` later than now is no read (a hand edit, a clock set back), else it would
// stop every later write.
export function newerReadOnDisk(root, snap) {
  const disk = readSnapshotFile(root);
  const diskRead = disk ? disk.fetched : null;
  if (!diskRead || Date.parse(diskRead) > Date.now()) return false;
  const thisRead = snap && snap.fetched;
  return !thisRead || diskRead > thisRead;
}

// Which snapshot a read that is not live read, in the words a command prints.
export const snapshotSource = (tracker) => (tracker.fromMainCheckout ? "the main checkout's snapshot" : "the snapshot");

// The day Roadkeeper first saw each issue with no creation date: the previous snapshot's, or today. A dated issue has none.
function stampSeen(snap, previous) {
  const before = new Map((previous ? previous.issues : []).map((i) => [i.number, i.seenAt]));
  const today = todayLocal();
  for (const i of snap.issues) i.seenAt = i.createdAt ? null : before.get(i.number) || today;
  return snap;
}

// The tracker read live within `budget` milliseconds and written whole to the tree's own snapshot, unless a newer read
// is on disk; offline, or when `gh` fails, the tree's snapshot (readTreeSnapshot). Never throws: { snap, live, error,
// failure, fromMainCheckout }, where error is `gh`'s own first line, failure its kind (classifyFailure), both null with no
// failure, and fromMainCheckout says the snapshot read is the main checkout's. `run(args, root, left)` makes one gh call
// and returns what it printed.
export function readTracker(root, offline, budget = 4 * GH_TIMEOUT, run = gh) {
  if (offline) return { ...readTreeSnapshot(root), live: false, error: null, failure: null };
  try {
    const snap = cleanAndStamp(root, fetchTracker(root, Date.now() + budget, run));
    const path = join(root, SNAPSHOT);
    if (insideRoot(root, path) && !newerReadOnDisk(root, snap)) replaceFile(path, JSON.stringify(snap, null, 1) + "\n");
    return liveResult(snap);
  } catch (e) { return failedResult(root, e); }
}

// The tracker read live for the session line's counts within `budget` milliseconds (fetchTrackerForCounts): not
// whole, it writes no snapshot. When `gh` fails, the tree's snapshot. Never throws: readTracker's shape.
export function readTrackerForCounts(root, budget, run = gh) {
  try {
    return liveResult(cleanAndStamp(root, fetchTrackerForCounts(root, Date.now() + budget, run)));
  } catch (e) { return failedResult(root, e); }
}

// a read's tracker `raw` cleaned, its first-seen days from the tree's snapshot (stampSeen)
const cleanAndStamp = (root, raw) => stampSeen(cleanSnapshot(raw), readTreeSnapshot(root).snap);

// a live read's result, readTracker's shape
const liveResult = (snap) => ({ snap, live: true, error: null, failure: null, fromMainCheckout: false });

// a failed read's result, readTracker's shape: the tree's snapshot, `gh`'s first line and the failure's kind
const failedResult = (root, e) => ({ ...readTreeSnapshot(root), live: false, error: ghError(e), failure: classifyFailure(e) });

// A read of the repository's REST lists within `budget` milliseconds, for a command needing what the snapshot leaves
// out (an issue's timeline): `list(path, cap, isEnough)`, startRead's `upTo` on `repos/<repository>/<path>`. Throws
// an Error carrying `gh`'s own first line when `gh` fails.
export function openTrackerRead(root, budget, run = gh) {
  const wrapFailure = (e) => Object.assign(new Error(ghError(e)), { kind: classifyFailure(e) });
  let read;
  try { read = startRead(root, Date.now() + budget, run); } catch (e) { throw wrapFailure(e); }
  const list = (path, cap, isEnough) => {
    try { return read.upTo(`repos/${read.name}/${path}`, cap, isEnough); } catch (e) { throw wrapFailure(e); }
  };
  return { list };
}

// a milestone's title while another takes its own: unique by its number, and opening on no version
const temporaryTitle = (number, title) => `renumbering #${number}: ${title}`;

// Renames each milestone of `renames` ({ number, from, to }, its title now and the one it takes) whose title changes,
// through `run`, the title passed as one argument. Where the title taken is one another milestone of `renames` still
// holds, that one passes through a temporary title first. Never throws: the steps sent, { number, from, to, error },
// where error is `gh`'s own first line or null; a step refused does not stop the others.
export function renameMilestones(root, renames, run = gh) {
  const changed = renames.filter((r) => r.to !== r.from);
  const held = new Map(changed.map((r) => [r.number, r.from])); // each changed milestone's title as the steps leave it
  const steps = [];
  const send = (number, to) => {
    const from = held.get(number);
    let error = null;
    try {
      run(["api", "--method", "PATCH", `repos/{owner}/{repo}/milestones/${number}`, "--raw-field", `title=${to}`], root, GH_TIMEOUT);
      held.set(number, to);
    } catch (e) { error = ghError(e); }
    steps.push({ number, from, to, error });
  };
  for (const r of changed) {
    const holder = [...held].find(([n, title]) => n !== r.number && title === r.to);
    if (holder) send(holder[0], temporaryTitle(holder[0], holder[1]));
    send(r.number, r.to);
  }
  return steps;
}
