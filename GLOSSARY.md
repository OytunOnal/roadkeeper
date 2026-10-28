# Roadkeeper

A Claude Code plugin that runs a project from an idea to a maintained product on top of Matt Pocock's skills, with the work on the project's issue tracker.

## Language

### The package

**Roadkeeper**:
The plugin (formerly Spine, until v3.0.0), and its contribution: which stage runs when, where the human decides, and what the work leaves on the tracker.
_Avoid_: pipeline (a run is a pipeline; the package is Roadkeeper), framework

**Workshop**:
The private repository where Roadkeeper is built, its tracker and records.
_Avoid_: source repository, monorepo

**Public copy**:
The public repository holding one release's plugin tree, updated at each release.
_Avoid_: mirror, fork

**Genesis**:
The run-once mode, idea to v1. Entry skill `/roadkeeper:genesis`.
_Avoid_: bootstrap, setup

**Steward**:
The run-forever mode: a report is classified, diagnosed against the promise it broke, offered as options, and fixed through a slice. Entry skill `/roadkeeper:steward`.
_Avoid_: maintenance mode

**Target project**:
The repository a Roadkeeper run works on. Its record lives there and on its tracker, never in the Roadkeeper repository.
_Avoid_: workspace, client project

**Records folder**:
A target project's `docs/roadkeeper/`, where Roadkeeper keeps what it writes there (the commands file, The Road's page, the structure file); a project without one, or with a link in its place, is not a Roadkeeper project.
_Avoid_: state folder, config folder

**Promise**:
What the project said it would do: a line in the one-pager, a user story in a spec, a rule in a skill, a metric's target. Steward diagnoses every report against one.
_Avoid_: requirement, contract

### Genesis

**Scale**:
Genesis's first stage: the idea's level, Sketch, Build or Product.
_Avoid_: triage (Pocock's skill of that name sorts issues)

**Brainstorm**:
The skill that turns an idea into a one-pager: variations, then directions stress-tested and researched, then the chosen one grilled until dry.
_Avoid_: ideation, discovery phase

**Persona**:
A user the one-pager names; every product-critique walk plays one.
_Avoid_: user type, audience

**Dry**:
A grill is dry when a round changes nothing: no new answer, no new assumption.

**Walking skeleton**:
The first slice of a Build or Product project: the thinnest end-to-end path.

**Adopt**:
Genesis run on existing material instead of a bare idea.
_Avoid_: migration, import, onboarding

**Inventory**:
The evidence-graded account of an adopted project: stack, running state, a verdict per module (keep / keep-but-fix / port / rebuild), implied decisions, domain terms, open questions.
_Avoid_: audit, assessment

**Tour**:
The walk through an inventory with the human, module by module, taking their corrections.
_Avoid_: onboarding doc

### The work on the tracker

**Slice**:
An issue on a milestone, named by what becomes possible once it lands; it goes from grill to real use through the `slice` skill. Once specced, the spec carries it: the issue and its spec are one slice.
_Avoid_: sprint, ticket (Pocock's word for the parts a spec is cut into)

**Fold**:
An issue taken into a slice that shares its files or its concern, closed as `duplicate`; the slice carries its text.
_Avoid_: merge, epic

**mock-green / real-green**:
Board labels on a slice, or on the issue carrying its real use: merged, not yet tried in real use; tried in real use and working. `active` comes before both.
_Avoid_: done, verified

**Milestone**:
A version, `vX.Y.Z`, named by what the product can do; it holds at most five slices. Its number is a forecast until its release. Ready to close when it is still open, counts at least one slice, and every slice is closed; a real-use issue still open does not hold it.
_Avoid_: changelog, sprint

**Bump**:
What a slice does to the version number: a slice the user must act on to keep working, or one the human names as opening a new era, raises X; a new promise Y; a fix, internal work or polish Z. A milestone takes its slices' largest bump.
_Avoid_: increment, raise

**Polish**:
An enhancement that adds no promise.
_Avoid_: tweak, chore

**Re-plan**:
The moment a milestone closes, when every open milestone and every candidate are read together: folded, merged, placed, ordered and renumbered. Between re-plans an open milestone keeps its scope.
_Avoid_: grooming, backlog refinement

**Current milestone**:
The first open milestone, by version. The largest version closed is the last version.
_Avoid_: current version

**Ticket**:
A part a spec is cut into, a sub-issue of the spec. It closes when it is merged into the spec's integration branch; the spec stands for it on The Road, which draws and counts it nowhere else.
_Avoid_: task, subtask

**In flight**:
An open issue labelled `active` or `mock-green`: the work The Road's Now holds.
_Avoid_: in progress, current

**Release**:
A milestone closed from v1 on, published to real users; `launch` runs before it.
_Avoid_: deploy, ship

**Candidate**:
An issue with no milestone: what becomes possible, why, and the bet it rests on. Placed on a milestone at the next re-plan, or when three slices' worth gather; it waits longer only with a reason written on it.
_Avoid_: feature request, wishlist

**De-mock debt**:
An issue opened on the current milestone the moment a build leaves a mock: replace it with the real thing.
_Avoid_: TODO, tech debt

**waiting-on-you**:
An issue only the human can act on.
_Avoid_: action item, reminder

**The Road**:
The page drawn from the tracker (`docs/roadkeeper/road.html`), in three tabs: progress (the current milestone's share of slices done; done, by closed milestone; now, the work in flight; next, the current milestone; ahead, by milestone); waiting on you; architecture. A view, never a record.
_Avoid_: dashboard, board; "The Road" for its progress tab

**Rail**:
The line down The Road's progress tab that its groups (Done, Now, Next, Ahead) hang on, each issue a marker on it.
_Avoid_: axis; timeline, which is an issue's events on the tracker

**Summary**:
An issue's first paragraph, under its title: why it matters and to whom, in plain words; The Road shows it on the issue's card.
_Avoid_: description, excerpt, first line

**Size step**:
How far The Road shrinks its Architecture drawing to fit the page: the first step draws it whole; past the last, the drawing is left out and said.
_Avoid_: fold, level

### Structure

**Structured project**:
A project that declares its levels and exceptions in `docs/roadkeeper/dependency-rules.md`; the structure check runs on it.
_Avoid_: leveled project, project with rules

**Module**:
Anything with an interface and an implementation, at any scale: a function, a file, a folder. Deep or shallow.
_Avoid_: component, service

**Deep module**:
A module with much behaviour behind a small interface; the modules under it may be deep themselves. One that spans files has a folder: its entry is the interface, the rest is private. Seen from outside, it has its entry's level.
_Avoid_: package, feature

**Entry**:
The one file at a deep module's folder root; code outside the module depends on it or runs it, and on nothing else in the folder. Its first comment names its level: the outermost level it wires.
_Avoid_: public file, index, interface file

**Root file**:
A source file directly in a deep module's folder, tests aside. With more than one, the module has no entry, and the check reports them.
_Avoid_: top-level file, interface file

**Mixed levels**:
Of a file: it names more than one level. A violation; a deep module whose files hold different levels is not.
_Avoid_: multi-level file, spanning file

**Ruling**:
What the structure check says about one dependency between two files; its kinds are the rulings the structure check prints.
_Avoid_: verdict (the inventory's), judgement (a grade), mark

**Exception**:
A line of `docs/roadkeeper/dependency-rules.md` that lets a dependency break the rules until a day or a version. A line naming one path covers only what is wrong with that path itself, never its edges or a cycle: a file's mixed levels or missing level, a module's root files or missing level.
_Avoid_: waiver, allowlist entry

**Due**:
Of an exception: its day has come, or its version or a later one is closed on the tracker.
_Avoid_: expired, lapsed

**Debt**:
A violation an exception still covers, its review point not yet come.
_Avoid_: tech debt, known issue

**Review point**:
The day or the version an exception names; it is due when that day comes or that version closes.
_Avoid_: expiry, deadline

**Structure report**:
What the structure check says about a project's structure as a whole: its violations, its debt, what it could not read (unread), and whether the graph is older than the code (stale). The check prints it, the stamp refuses by it, The Road draws it.
_Avoid_: verdict (the inventory's), result

### Evidence

**Grounded**:
Of a research claim: backed by a fetched URL or a quoted source, with found and inferred marked apart. Ungrounded claims do not survive into documents.
_Avoid_: verified, sourced

**Evaluate**:
Roadkeeper's measurement of a skill or agent file on a golden set.
_Avoid_: eval suite, benchmark

**Green**:
The project's whole check passing at once: every suite, the check command and the plugin check. Nothing is merged that is not green.
_Avoid_: CI, test run

**Green stamp**:
The record of a tree that ran green, shared by every worktree of a clone, so neither a green run nor a merge tests a stamped tree again.
_Avoid_: stamp alone (the structure stamp's word)

**Tested tree**:
The tree a green runs on: the last commit's with nothing uncommitted, else the one committing all of it would make. Its green stamp is named by it.
_Avoid_: working tree (git's word for the files on disk)

**Sibling**:
A folder outside a project's root that its manifest names as a dependency by its path; a run on an older commit finds it beside the main checkout.
_Avoid_: neighbour, external package, local dependency

**Stack**:
The word a project's commands file names, saying which formats Roadkeeper reads its test runs and linter in, and which defaults it starts from.
_Avoid_: language, tech stack

**General lint line**:
The line `path:line:col: CODE message` a linter prints for one finding, the column optional: ruff's, flake8's, pylint's by its template and Roadkeeper's check's. The `python` stack reads it.

**Case id**:
A test case's handle, the first word of its name, saying what it checks: named in a command, a review or a threat's row, and kept when the rest of the name is reworded.
_Avoid_: case number, test code

**Ceiling**:
Of a code file past the size limits: its lines and characters as recorded when the limits came. The file may not pass either, and leaves the record once under both limits.
_Avoid_: debt (the structure's word), allowance

**Suppression**:
Of a function rule: the count of its breaches recorded for one file. The count may not grow, and the row leaves when it reaches none.
_Avoid_: debt (the structure's word), waiver

### Coding standards

**General rule**:
A coding rule that holds in every Roadkeeper project, kept once in the plugin's `ROADKEEPER_STANDARDS.md`; a project's `CODING_STANDARDS.md` names that file and holds only its own lines.
_Avoid_: template rule, default rule, Roadkeeper rule (Roadkeeper's own lines are a project's)

**Departure**:
A line in a project's `CODING_STANDARDS.md`, under `## Departures`, that names a general rule, gives the project's version and why. It wins over the general rule in that project.
_Avoid_: exception (the structure's word), override
