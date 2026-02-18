# Agent Delivery Guidelines

These rules define how implementation work should be shipped in this repository.

## Commit Discipline
- Make exactly one logical task per commit.
- Keep commits scoped and reviewable.
- Use commit messages that name the task outcome.

## Testing Requirements
- Every implementation task must include behavioral test coverage.
- Prefer fakes over mocks.
- Use realistic test data and filesystem-backed temp fixtures when appropriate.
- Cover success paths and key failure/edge conditions for the task.

## Documentation Requirements
- Keep documentation up to date in the same task commit.
- Update `README.md` and/or `CLI.md` when behavior, commands, or workflow changes.
- When adding new persistent files or schemas, document location and purpose.

## Definition of Done (Per Task)
- Code implemented and wired.
- Behavioral tests added and passing.
- Relevant docs updated.
- Committed as a single task-focused commit.
