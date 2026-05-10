#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.pi/agent/extensions"

mkdir -p "$TARGET_DIR"
rm -f "$TARGET_DIR/git-status-hud.ts"
cp "$ROOT_DIR/extensions/status-hud/status-hud.ts" "$TARGET_DIR/status-hud.ts"

echo "Installed: $TARGET_DIR/status-hud.ts"
echo "Reload Pi with /reload if it is already running."
