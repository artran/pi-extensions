# Build a Pi extension that adds a visible Git Status HUD to the UI.

## Goal:
Show useful git context at a glance in Pi: current branch and repository state.

## Implement in this repo with:
- `extensions/git-status-hud/git-status-hud.ts`
- `extensions/git-status-hud/README.md`
- Update `install.sh` to include this extension
- Update top-level `README.md` with a short section and install instructions

## Requirements:
1 UI output (obvious and useful)
    - Show a persistent status/footer entry with:
        - Branch name
        - Clean or dirty state
        - Count of staged, unstaged, and untracked files
    - Also show a small widget (above or below editor) with a compact summary, for example:
        - branch: main | clean
        - branch: feature/x | unstaged: 2 | staged: 1 | untracked: 3

2. Behavior
    - Update on session start
    - Update after each agent turn/tool execution
    - Add command: `/git-hud [on|off|toggle|status|refresh]`
