#!/usr/bin/env sh
set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [ ! -x .venv/bin/python ] || [ ! -x .venv/bin/uvicorn ]; then
  sh scripts/setup.sh
fi

if [ ! -f frontend/dist/index.html ]; then
  if [ ! -d frontend/node_modules ]; then
    npm --prefix frontend install
  fi
  npm --prefix frontend run build
fi

. .venv/bin/activate

HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}

echo "Starting MedShelf on http://${HOST}:${PORT}"
exec python -m uvicorn backend.app.main:app --host "$HOST" --port "$PORT"
