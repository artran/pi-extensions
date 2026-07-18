# Worktrunk setup

Use this branch for machine setup, a fresh bare-layout clone, or repairing remote detection. Preserve existing configuration with targeted edits.

## Install the executable

1. Inspect `wt --version`, `wt --help`, repository files, the active shell, and existing user configuration.
2. If the project has `devbox.json`, add Worktrunk to that project with `devbox add worktrunk`, show the manifest and lockfile changes, and invoke it through the Devbox environment when `wt` is not otherwise on `PATH`.
3. Otherwise, on a Homebrew system ensure `brew "worktrunk"` exists in `~/.Brewfile`, then install the formula directly. Avoid applying the entire global bundle as a side effect.
4. On another platform, discover a supported package-manager command and get Ray's confirmation before running it.

Installation is complete when the selected environment runs `wt --version` and the installed help has been inspected.

## Configure Ray's defaults

Plan and show dotfile changes before applying them. Create files only when absent; preserve unrelated settings when present.

The effective user configuration must include:

```toml
worktree-path = "../{{ branch | sanitize }}"

[list]
json-schema = 2

[commit.generation]
command = "pi -p --thinking low --no-session --no-tools --no-extensions --no-skills --no-prompt-templates --no-context-files --no-approve --system-prompt=''"
```

The pi command deliberately follows the configured default model, consumes Worktrunk's piped prompt, and excludes tools, sessions, project trust, context files, and optional resources.

Ensure the global Git alias remains the single source for bare cloning:

```ini
[alias]
    cb = clone --bare -c remote.origin.fetch='+refs/heads/*:refs/remotes/origin/*'
```

Use `wt config shell install` for the detected interactive shell after reviewing its proposed shell-file change. Verify effective values with `wt config show`; do not infer success from file contents alone.

Machine setup is complete when `wt` is runnable in the intended environment, shell integration is effective, config schema 2 is active, commit generation is available, and the bare path template is reported.

## Clone a repository

Default a URL-only request to `~/projects/<remote-repository-name>`. An explicit destination wins. Stop when the destination contains unrelated data.

1. Create the repository directory and run `git cb <url> <destination>/.git`.
2. Detect the remote's default branch from its symbolic remote HEAD. Refresh `origin/HEAD` when needed. For an empty remote, use Ray's configured Git default branch.
3. Create the primary worktree for the actual default branch with `wt -C <destination>/.git switch <default> --no-cd --format=json`. Discover its absolute path from the JSON response or a schema-2 list.
4. Establish tracking explicitly. When `origin/<default>` exists, set the local default branch's upstream to it without pushing. When it does not exist, create the initial commit as appropriate and use `git push --set-upstream origin <default>`.
5. Fetch, then fast-forward the primary worktree to its upstream. A dirty or diverged default branch requires Ray's decision.
6. Verify that Worktrunk reports the default branch, primary path, forge metadata, and primary remote. A successful Git clone without Worktrunk remote detection is incomplete.

The resulting layout is:

```text
~/projects/<repo>/
├── .git/              # bare common repository
├── <default-branch>/  # primary integration worktree
└── <task-branch>/     # created later by wt
```

The clone is complete only when upstream tracking exists and `wt config show` plus `wt list --format=json` recognize the remote and primary worktree.

## Repair remote detection

Inspect the remote URL, fetch refspec, `origin/HEAD`, default branch, and `branch.<default>.{remote,merge}`. Prefer establishing tracking directly when `origin/<default>` already exists. Use `git push --set-upstream` only when the remote branch is absent or publication is otherwise intended. Re-run Worktrunk's config and list inspection; repair is complete when the structured repository metadata names the remote.
