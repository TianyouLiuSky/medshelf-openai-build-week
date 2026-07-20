#!/usr/bin/env sh
set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  echo "Created Python virtual environment at .venv"
fi

. .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm --prefix frontend install

echo "MedShelf setup complete."
