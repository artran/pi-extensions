# Build a Pi extension that adds a visible status HUD to the UI.

## Goal

Show the current context size at a glance in Pi without displaying repository information.

## Implement in this repo with

- `extensions/status-hud/status-hud.ts`
- `extensions/status-hud/README.md`
- Update `install.sh` to include this extension
- Update top-level `README.md` with a short section and install instructions

## Requirements

1. UI output
   - Show the current context size in a persistent footer status entry.
   - Also show it in a small widget above or below the editor.
   - Colour it green up to 50k tokens, yellow up to 75k, and red above.

2. Behavior
   - Update on session start.
   - Update after each agent turn and tool execution.
   - Add command: `/status-hud [on|off|toggle|status|refresh]`.
