# Migrating a conventional clone

Migration creates and validates a separate bare-layout clone. The original checkout remains the rollback source until Ray explicitly archives or deletes it.

1. Inventory the existing clone: remote URLs, default branch, every local branch and upstream, tags, submodules, Git LFS state, worktrees, stashes, uncommitted files, untracked files, ignored local dependencies, and in-progress Git operations. Record commit IDs for every local branch. Inventory is complete when every piece of local-only state has a named preservation route.
2. Reach a preservable source state. Prefer committed changes and pushed branches; retain local-only refs explicitly when publication is inappropriate. Copy ignored files only after file-by-file review, especially secrets. An in-progress Git operation or unaccounted change blocks migration.
3. Choose a separate destination, normally `~/projects/<repo>` when the conventional clone is elsewhere. A collision requires a new path rather than in-place conversion.
4. Follow [SETUP.md](SETUP.md) to make a fresh bare clone from the canonical remote and create its actual default-branch worktree.
5. Import each required local-only branch or tag from the old clone without overwriting a different destination ref. A same-name/different-commit collision requires Ray's choice. Create task worktrees with `wt switch` only when active work needs them.
6. Restore approved local files and run repository setup. Validate remote detection, upstream tracking, branch commit IDs, tags, submodules/LFS where used, `wt list --format=json`, clean status, and the repository's normal checks.
7. Present an old-to-new state ledger covering every item from the inventory. Leave the original checkout untouched.

Migration is complete only when every old branch and local artifact is accounted for, the new clone passes Worktrunk and project validation, and the original remains available for rollback. Archival or deletion is a separate explicit cleanup action.
