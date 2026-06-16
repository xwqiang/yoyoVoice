#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=ensure-venv.sh
source "$ROOT/scripts/ensure-venv.sh"

venv_py="$ROOT/backend/.venv/bin/python3"
needs_install=0
if [ ! -x "$venv_py" ] || ! "$venv_py" -c "import sys" 2>/dev/null; then
  needs_install=1
fi

ensure_venv "$ROOT/backend/.venv"

if [ "$needs_install" = 1 ]; then
  install_venv_deps "$ROOT/backend/.venv" "$ROOT/backend/requirements.txt" --only-binary=cursor-sdk
fi

if [ ! -d "frontend/node_modules" ]; then
  cd frontend && npm install && cd ..
fi

trap 'kill 0' EXIT

echo "Starting backend on http://0.0.0.0:8000"
cd "$ROOT/backend" && ../backend/.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
echo "Starting frontend dev server on http://0.0.0.0:5173"
cd "$ROOT/frontend" && npm run dev -- --host 0.0.0.0 --port 5173 &

wait
