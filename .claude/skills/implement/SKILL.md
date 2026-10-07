---
name: implement
description: "Implementa um trabalho com base numa spec ou conjunto de tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Before writing code, mark each issue you are taking as in progress: assign yourself, add the `em-andamento` label and comment the branch name (rule 10, commands in `docs/agents/issue-tracker.md`). If an issue already has an assignee or the `em-andamento` label, stop and ask the user before touching it.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /spec-code-review to review the work.

Commit your work to the current branch.
