#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Cursor prepends its bundled Node to PATH; strip it so nvm/system npm is used.
export PATH="$(
  echo "$PATH" | tr ':' '\n' | grep -v 'Cursor.app' | paste -sd ':' -
)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null 2>&1 || nvm use default --silent >/dev/null 2>&1 || true
fi

NPX="${NPX:-}"
if [[ -z "$NPX" && -n "${NVM_BIN:-}" && -x "${NVM_BIN}/npx" ]]; then
  NPX="${NVM_BIN}/npx"
elif [[ -z "$NPX" ]]; then
  NPX="$(command -v npx || true)"
fi
if [[ -z "$NPX" || "$NPX" == *Cursor.app* ]]; then
  NPX="$(ls -1 "$HOME/.nvm/versions/node/"*/bin/npx 2>/dev/null | sort -V | tail -1)"
fi
if [[ ! -x "$NPX" ]]; then
  echo "shadcn MCP: npx not found (checked nvm and PATH)" >&2
  exit 1
fi

exec "$NPX" --yes shadcn@latest mcp
