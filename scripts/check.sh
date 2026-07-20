#!/usr/bin/env sh
set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -x .venv/bin/python ] || [ ! -x .venv/bin/pytest ] || [ ! -d frontend/node_modules ]; then
  sh scripts/setup.sh
fi

npm --prefix frontend run build

. .venv/bin/activate
python -m pytest backend
