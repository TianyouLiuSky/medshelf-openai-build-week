#!/usr/bin/env sh
set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [ ! -x .venv/bin/python ] || [ ! -x .venv/bin/uvicorn ] || [ ! -d frontend/node_modules ]; then
  sh scripts/setup.sh
fi

. .venv/bin/activate

BACKEND_HOST=${BACKEND_HOST:-127.0.0.1}
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_HOST=${FRONTEND_HOST:-127.0.0.1}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

if [ -z "${BACKEND_CORS_ORIGINS:-}" ]; then
  BACKEND_CORS_ORIGINS="http://${FRONTEND_HOST}:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}"
  export BACKEND_CORS_ORIGINS
fi

if [ -z "${VITE_API_BASE_URL:-}" ] && { [ "$BACKEND_HOST" != "127.0.0.1" ] || [ "$BACKEND_PORT" != "8000" ]; }; then
  VITE_API_BASE_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
  export VITE_API_BASE_URL
fi

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

echo "Starting MedShelf API at http://${BACKEND_HOST}:${BACKEND_PORT}"
python -m uvicorn backend.app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

echo "Starting MedShelf web app at http://${FRONTEND_HOST}:${FRONTEND_PORT}"
npm --prefix frontend run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

echo "Press Ctrl+C to stop both servers."

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

cleanup
wait "$BACKEND_PID" 2>/dev/null || true
wait "$FRONTEND_PID" 2>/dev/null || true
