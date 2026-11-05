@AGENTS.md

## Claude

- Clear context between tasks. Start each slice from its plan file, not from memory.
- Use the mid-tier model by default. Move up only for a design decision or a review that needs it.
- The fresh-context review is `/code-review` in a new session (or a subagent), never the session
  that wrote the diff.
