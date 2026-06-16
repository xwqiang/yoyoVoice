#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV_PY="$ROOT/backend/.venv/bin/python3"
APP_DIR="$ROOT/backend"

run_uvicorn() {
  exec "$1" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir "$APP_DIR"
}

if [ -x "$VENV_PY" ] && "$VENV_PY" -c "import sys" 2>/dev/null; then
  run_uvicorn "$VENV_PY"
fi

if command -v uvicorn >/dev/null 2>&1; then
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir "$APP_DIR"
fi

# Self-hosted fallback: bootstrap venv when system uvicorn is unavailable.
# shellcheck source=scripts/ensure-venv.sh
source "$ROOT/scripts/ensure-venv.sh"
ensure_venv "$ROOT/backend/.venv"
install_venv_deps "$ROOT/backend/.venv" "$ROOT/backend/requirements.txt"
run_uvicorn "$VENV_PY"
