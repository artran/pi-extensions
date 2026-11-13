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

Switches models when you explicitly invoke a Matt Pocock skill with `/skill:name`
or `/name`. Uses OpenAI Codex for correctness-sensitive work and visual prototypes,
and OpenCode Go for routine tasks. Sign in to both providers with `/login`.

Run `/skill-routes` to see the model and thinking level assigned to each skill.
Reading nested skills does not switch models; subagent models are configured
separately. Model changes persist for the session until you select another model
or invoke another routed skill.

Files:
- `extensions/matt-pocock-router/matt-pocock-router.ts`

Install just this extension:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/matt-pocock-router/matt-pocock-router.ts ~/.pi/agent/extensions/matt-pocock-router.ts
```

