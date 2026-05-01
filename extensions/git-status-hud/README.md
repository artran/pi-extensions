# git-status-hud

A Pi extension that shows Git state in two places:
- a persistent footer status entry
- a compact widget below the editor

It displays:
- current branch
- clean/dirty state
- counts for staged, unstaged, and untracked files

## Files

- `git-status-hud.ts` — extension entrypoint
- `git-status-hud-specs.md` — original spec

## Install

Global install:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/git-status-hud/git-status-hud.ts ~/.pi/agent/extensions/git-status-hud.ts
```

Or use this repo's installer:

```bash
./install.sh
```

## Usage

Start Pi, then use:

```text
/git-hud on
/git-hud off
/git-hud toggle
/git-hud status
/git-hud refresh
```
