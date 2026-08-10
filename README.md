# pi-extensions

## Install

Install all extensions from this repo:

```bash
./install.sh
```

Custom Pi extensions collected in this repo.

## Included

### status-hud

Shows the current context size in Pi's footer and below the editor, coloured green up to 50k tokens, yellow up to 75k, and red above.

Files:
- `extensions/status-hud/status-hud.ts`

Install just this extension:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/status-hud/status-hud.ts ~/.pi/agent/extensions/status-hud.ts
```

### matt-pocock-router

Automatically switched the selected model to suit whichever Matt Pocock skill is
running. Models are selected from OpenCode Go.

Files:
- `extensions/matt-pocock-router/matt-pocock-router.ts`

Install just this extension:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/matt-pocock-router/matt-pocock-router.ts ~/.pi/agent/extensions/matt-pocock-router.ts
```

