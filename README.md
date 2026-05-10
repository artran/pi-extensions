# pi-extensions

Custom Pi extensions collected in this repo.

## Included

### status-hud

Shows a status HUD in Pi with:
- current branch
- clean/dirty state
- staged / unstaged / untracked counts
- current context size in k tokens (green up to 50k, yellow up to 75k, red above)

Files:
- `extensions/status-hud/status-hud.ts`

## Install

Install all extensions from this repo:

```bash
./install.sh
```

Or install just this extension:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/status-hud/status-hud.ts ~/.pi/agent/extensions/status-hud.ts
```
