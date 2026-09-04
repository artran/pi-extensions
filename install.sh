#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.pi/agent/extensions"

mkdir -p "$TARGET_DIR"

rm -f "$TARGET_DIR/git-status-hud.ts"
rm -f "$TARGET_DIR/status-hud.ts"

rm -f "$TARGET_DIR/matt-pocock-router.ts"
cp "$ROOT_DIR/extensions/matt-pocock-router/matt-pocock-router.ts" "$TARGET_DIR/matt-pocock-router.ts"
echo "Installed: $TARGET_DIR/matt-pocock-router.ts"

rm -f "$TARGET_DIR/usage-status.ts"
cp "$ROOT_DIR/extensions/usage-status/usage-status.ts" "$TARGET_DIR/usage-status.ts"
echo "Installed: $TARGET_DIR/usage-status.ts"

echo "Reload Pi with /reload if it is already running."
