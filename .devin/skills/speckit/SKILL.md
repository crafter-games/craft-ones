---
name: speckit
description: Apply the installed GitHub Spec Kit workflow to Craft Ones. Use for specifying milestones, planning scoped gameplay work, implementing tasks, and checking convergence against acceptance criteria.
---

# Craft Ones Spec Kit

Use the upstream Spec Kit v1.0.0 commands in `.devin/commands/speckit.<stage>.md` as the stage reference. Read only the current stage.

The Spec Kit project root is `.devin/`, while application code lives one directory above in `apps/` and `packages/`. Set `SPECIFY_INIT_DIR` to the absolute `.devin` path when invoking bundled scripts. Run the pinned CLI with `uvx --from git+https://github.com/github/spec-kit.git@v1.0.0 specify` from `.devin/`.

Use this repository's lightweight adaptation: `AGENTS.md` at the repository root holds governing principles and acceptance criteria; the session task list holds implementation tasks. Do not generate separate specification, plan, research, or task documents unless governing instructions allow them. The bundled constitution is an untouched upstream template, not this project's governing policy.

1. Specify: restate the requested player behavior and measurable acceptance criteria; keep exclusions explicit.
2. Plan: inspect current code and propose the fewest components needed. No speculative systems.
3. Tasks: track small verifiable slices in the session task list.
4. Implement: write a failing regression, implement the behavior, and commit verified slices when requested.
5. Converge: compare every acceptance criterion with test evidence. Run `bun test`, `bun run typecheck`, `bun run lint`, `bun run build`, and `bun run test:e2e` from the repository root. Report missing evidence honestly, then fix scoped gaps.

Never push, create issues, or deploy without explicit user permission. Do not run the task-to-issues command for local milestone tracking.
