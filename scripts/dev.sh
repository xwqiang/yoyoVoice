#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d "backend/.venv" ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt --only-binary=cursor-sdk
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
