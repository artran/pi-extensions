# pi-extensions

Custom Pi extensions collected in this repo.

## Included

### git-status-hud

Shows a Git HUD in Pi with:
- current branch
- clean/dirty state
- staged / unstaged / untracked counts

Files:
- `extensions/git-status-hud/git-status-hud.ts`

## Install

Install all extensions from this repo:

```bash
./install.sh
```

Or install just this extension:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/git-status-hud/git-status-hud.ts ~/.pi/agent/extensions/git-status-hud.ts
```
