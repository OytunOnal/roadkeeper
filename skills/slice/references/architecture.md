# docs/roadkeeper/ARCHITECTURE.md

A mermaid diagram of the project as built: repos, modules, data flow, and where the trust boundary sits (what runs where, what leaves the device). Beside the diagram, one line per component saying what it is.

Where the slice carried a `## Structure` plan, draw the modules as `node ${CLAUDE_PLUGIN_ROOT}/scripts/structure-plan.mjs check` read them, not as planned.

## Diagram rules

Keep every block valid mermaid, never ASCII art: it is read on the code host and in editors.

- **One diagram answers one question.** Topology, data flow, the trust boundary and state are different questions; a diagram that answers two is split into two.
- **A node label is a name**, one or two words. Anything more goes in the list beside the diagram.
- **Direction follows shape:** a pipeline left to right, a hierarchy top to bottom, a state machine as `stateDiagram-v2`.
- **Read it before closing the file**, as someone who has not seen the code. A node that cannot be read is split off or renamed, never shrunk.
