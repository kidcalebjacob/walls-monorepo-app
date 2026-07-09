#!/usr/bin/env bash
# Workarounds for Expo + monorepo path with spaces ("WALLS Entertainment").
# Local macOS iOS dev only — skipped on Vercel/CI/Linux.

set -euo pipefail

if [[ -n "${CI:-}" ]] || [[ -n "${VERCEL:-}" ]] || [[ "$(uname -s)" != "Darwin" ]]; then
  exit 0
fi

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_ROOT="$(cd "$APP_ROOT/../.." && pwd)"

patch_get_app_config_ios() {
  local script="$MONOREPO_ROOT/node_modules/expo-constants/scripts/get-app-config-ios.sh"
  if [[ ! -f "$script" ]]; then
    return
  fi

  if grep -q 'basename "$PROJECT_DIR"' "$script"; then
    return
  fi

  sed -i '' 's/PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)/PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")/' "$script"
  echo "Patched expo-constants get-app-config-ios.sh for paths with spaces"
}

patch_get_app_config_ios

for LOCKDOWN_CLIENT in \
  "$MONOREPO_ROOT/node_modules/@expo/cli/build/src/run/ios/appleDevice/client/LockdowndClient.js" \
  "$MONOREPO_ROOT/node_modules/expo/node_modules/@expo/cli/build/src/run/ios/appleDevice/client/LockdowndClient.js"
do
  if [[ ! -f "$LOCKDOWN_CLIENT" ]]; then
    continue
  fi

  if grep -q 'debug(`startSession: ${pairRecord}`);' "$LOCKDOWN_CLIENT"; then
    perl -0pi -e 's/debug\(`startSession: \$\{pairRecord\}`\);/debug('\''startSession:'\'', pairRecord);/g' "$LOCKDOWN_CLIENT"
    echo "Patched Expo CLI device install bug in $LOCKDOWN_CLIENT"
  fi
done
