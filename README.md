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

### task-profiles

Select a model and thinking level for the work you are about to do:

| Command | Model | Thinking |
| --- | --- | --- |
| `/task rust` | `openai-codex/gpt-6.1-sol` | high |
| `/task research` | `opencode-go/qwen3.7-plus` | medium |
| `/task docs` | `openai-codex/gpt-6.1-terra` | medium |

Run `/task` to open a picker. Profile names support tab completion. You can also
start a request immediately:

```text
/task rust implement retry logic for this client
/task research compare Tokio cancellation patterns
/task docs document the authentication flow
```

Sign in to OpenAI Codex and OpenCode Go through `/login` first. A missing model or
failed sign-in check stops the command without sending the optional request.
Wait for the current task to finish before switching profiles.

Profiles select only the model and thinking level. They do not change tools,
load skills, or add workflow instructions. Research still needs web/documentation
tools or skills. Optional requests are sent as literal text, without slash-command
expansion. The selection persists for the session until another explicit model
change, `/task` selection, or routed skill command. Nested skill reads do not
change it.

Install just this extension, then run `/reload` in Pi:

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/task-profiles/task-profiles.ts ~/.pi/agent/extensions/task-profiles.ts
```

Run the task-profile tests with Node.js 22.18+ (native TypeScript stripping):

```bash
node --test extensions/task-profiles/task-profiles.test.mjs
```

