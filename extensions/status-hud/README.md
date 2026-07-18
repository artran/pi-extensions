# status-hud

A Pi extension that shows status information in two places:
- a persistent footer status entry
- a compact widget below the editor

It displays the current context size in k tokens, coloured green up to 50k, yellow up to 75k, and red above.

## Files

- `status-hud.ts` — extension entrypoint
- `status-hud-specs.md` — original spec

## Install

Global install:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/status-hud/status-hud.ts ~/.pi/agent/extensions/status-hud.ts
```

Or use this repo's installer:

```bash
./install.sh
```

## Usage

Start Pi, then use:

```text
/status-hud on
/status-hud off
/status-hud toggle
/status-hud status
/status-hud refresh
```
