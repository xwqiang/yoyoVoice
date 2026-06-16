#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1 || ! node -e '
const [major, minor] = process.versions.node.split(".").map(Number);
const ok =
  (major === 20 && minor >= 19) ||
  (major === 22 && minor >= 12) ||
  major > 22;
if (!ok) process.exit(1);
'; then
  cat >&2 <<EOF
ERROR: Node.js $(node -v 2>/dev/null || echo "not installed") is too old. Vite requires 20.19+ or 22.12+.

  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
EOF
  exit 1
fi

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
