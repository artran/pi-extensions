# usage-status

Replaces Pi's footer with a live usage HUD that fetches real limits and
usage from each logged-in provider.

## What it shows

- **cwd + git branch + session name**
- **Session token / cost totals** — input, output and spend for the current
  session
- **Context usage** — current tokens vs model context window
- **Active model** — including thinking level when applicable
- **Per-provider usage windows** — each logged-in provider starts on its own
  line and shows the percentage of quota *used* in each window, colour-coded:
  - 🟢 green — < 70 % used
  - 🟡 yellow — 70–89 % used
  - 🔴 red — ≥ 90 % used (or rate-limited)

Each usage window also shows a countdown to its next reset.

## Supported providers

| Provider       | Windows shown                              |
|----------------|--------------------------------------------|
| `opencode-go`  | rolling · weekly · monthly                 |
| `openai-codex` | rolling (e.g. 5 h) · weekly · monthly spend |

Other providers are silently ignored until a usage endpoint is known.

## Commands

- `/usage` — manually refresh usage data and re-render the footer.

## How it works

- On `session_start` the extension reads `~/.pi/agent/auth.json`, fetches
  usage for every provider it knows how to talk to, and replaces the footer
  renderer.
- Data is refreshed automatically every **60 s** and at the end of every
  agent turn (`agent_end`).
- For OpenAI Codex, the extension handles OAuth token refresh automatically
  and writes the new tokens back to `auth.json` so Pi stays logged in.

## Install

```bash
mkdir -p ~/.pi/agent/extensions
cp extensions/usage-status/usage-status.ts ~/.pi/agent/extensions/usage-status.ts
```

## Files

- `extensions/usage-status/usage-status.ts`

## Acknowledgement

Based on work by David McNulty
