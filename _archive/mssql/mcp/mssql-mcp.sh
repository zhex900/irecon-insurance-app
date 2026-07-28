#!/usr/bin/env bash
# Launch MSSQL MCP against the local Docker SQL Server container (`sqlserver`).
# Credentials: optional .env.mssql, else SA password from the running container.
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
  echo "mssql MCP: npx not found (checked nvm and PATH)" >&2
  exit 1
fi

ENV_FILE="${MSSQL_ENV_FILE:-$ROOT/.env.mssql}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

CONTAINER="${MSSQL_DOCKER_CONTAINER:-sqlserver}"
export SERVER_NAME="${SERVER_NAME:-127.0.0.1}"
export SQL_PORT="${SQL_PORT:-1433}"
export DATABASE_NAME="${DATABASE_NAME:-vs434253_1}"
export SQL_AUTH_MODE="${SQL_AUTH_MODE:-sql}"
export SQL_USERNAME="${SQL_USERNAME:-sa}"
export TRUST_SERVER_CERTIFICATE="${TRUST_SERVER_CERTIFICATE:-true}"

if [[ -z "${SQL_PASSWORD:-}" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "mssql MCP: SQL_PASSWORD not set and docker not found. Create .env.mssql (see .env.mssql.example)." >&2
    exit 1
  fi
  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "mssql MCP: container '$CONTAINER' not found. Start it or set SQL_PASSWORD in .env.mssql." >&2
    exit 1
  fi
  SQL_PASSWORD="$(
    docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' |
      awk -F= '/^(SA_PASSWORD|MSSQL_SA_PASSWORD)=/{print substr($0,index($0,"=")+1); exit}'
  )"
  if [[ -z "$SQL_PASSWORD" ]]; then
    echo "mssql MCP: could not read SA_PASSWORD from container '$CONTAINER'." >&2
    exit 1
  fi
  export SQL_PASSWORD
fi

# Also export mssql-mcp (BYMCS) env aliases in case we switch packages later.
export DB_SERVER="$SERVER_NAME"
export DB_PORT="$SQL_PORT"
export DB_DATABASE="$DATABASE_NAME"
export DB_USER="$SQL_USERNAME"
export DB_PASSWORD="$SQL_PASSWORD"
export DB_ENCRYPT="${DB_ENCRYPT:-true}"
export DB_TRUST_SERVER_CERTIFICATE="$TRUST_SERVER_CERTIFICATE"

exec "$NPX" --yes "@connorbritain/mssql-mcp-reader@latest"
