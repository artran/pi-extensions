---
name: worktrunk-workflow
description: Worktrunk workflow for Ray's bare Git repositories. Use when setting up Worktrunk or a repository, starting substantive code changes, managing a task worktree, integrating completed work, cleaning up worktrees, or migrating a conventional clone.
---

# Worktrunk workflow

Use Worktrunk as the control plane for worktree lifecycle. The installed `wt` binary is the syntax authority: run `wt --version`, `wt --help`, and the relevant command's help before relying on syntax that may have changed.

Read [SETUP.md](SETUP.md) when installing or configuring Worktrunk, cloning a repository, or establishing its primary worktree. Read [MIGRATION.md](MIGRATION.md) when converting an existing conventional clone. Read [INTEGRATION.md](INTEGRATION.md) only after Ray explicitly authorizes merging, publishing, or cleanup.

## Invariants

- Resolve repository state, branch names, and absolute worktree paths from schema-2 JSON. When effective config does not guarantee schema 2, run `wt --config-set list.json-schema=2 list --format=json`. Treat IDs and paths as discovered data, not naming predictions.
- Use `wt switch`, `wt list`, `wt merge`, and `wt remove` instead of raw `git worktree` commands. Use Git for ordinary source-control operations and gaps in Worktrunk.
- A primary worktree is an integration worktree. A task worktree contains one small, self-contained change.
- Repositories whose remote owner is `artran` are personal regardless of SSH host aliases. Every other repository is external unless Ray says otherwise.
- External repository instructions govern branch names, commits, checks, and contribution flow. Prepare external work for review; local integration into its default branch is outside this workflow.
- Task commits are a rollback journal: commit each coherent, passing increment. Final integration curates that journal into one self-contained commit.
- Publication and integration require explicit authorization. A completed task remains local and ready for review.

## Start or resume a task

1. Inspect repository instructions, `git status`, the remote, and `wt list --format=json`. Determine the default branch, primary worktree, current worktree, and whether the current topic branch matches the task. Continue in a matching topic worktree; isolate an unrelated task in a new one. This step is complete when the task root and clean baseline are known.

2. For substantive changes begun in the primary worktree, announce a proposed branch name and create it immediately when repository, base, and task boundary are unambiguous. First fetch and fast-forward a clean primary worktree to its upstream; a dirty or diverged primary worktree requires Ray's decision. Independent work starts from the synchronized default branch; another topic branch is a base only for an explicitly stacked change. This step is complete when Worktrunk reports a new task worktree at an absolute path.

   In personal repositories use `<type>/<kebab-case-description>`, where type is `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, or `experiment`. In external repositories follow the project's convention.

3. Run all reads, edits, setup, tests, and Git operations from the resolved task path. Honor approved Worktrunk hooks. Without a `pre-start` hook, use the repository's canonical lockfile-respecting setup command; propose a project hook when every worktree needs it. Start from tracked files, and copy ignored local files only through an explicitly reviewed hook or `wt step copy-ignored`; account for secrets file-by-file. This step is complete when the worktree can run the project's normal development commands.

4. Work in coherent passing increments. Stage only the increment, prefer `wt step commit --stage=none` when commit generation is configured, and inspect each generated message; otherwise use the repository's normal Git commit process. Keep task scope atomic. This step is complete when every intended change is committed and the worktree is clean.

5. Run every repository-documented check relevant to the change: formatting, lint, type checking, tests, and build. Report any check not run and why. This step is complete only when all applicable checks pass and `git status` is clean.

6. Report the branch, absolute path, commit journal, diff summary, and validation. Leave the worktree intact and local. This task branch is ready when Ray can review it without reconstructing missing state.

## Hooks and project configuration

Before approving a project hook, read and summarize every command. Routine repository-local setup and validation still require Ray's confirmation on first approval. Highlight credential, network, service, deployment, and outside-worktree effects.

Project configuration such as `.config/wt.toml` is shared code. Propose repository-derived `pre-start` and `pre-merge` hooks and wait for approval before adding them. Once approved, successful `pre-merge` hooks are mandatory unless Ray explicitly authorizes a bypass.

## Guardrails

- A stated branch name is enough to create an unambiguous task worktree; ask when repository, base, or task boundary is ambiguous.
- Pushing, opening a PR, squashing, rebasing, merging, and removing are authorization boundaries.
- Normal cleanup authorization does not authorize `--force` or `-D`. Before requesting either, show the exact branch, path, working-tree status, and default-branch divergence; approval must name the branch and force operation.
- Preserve worktrees and branches unrelated to the current task.
