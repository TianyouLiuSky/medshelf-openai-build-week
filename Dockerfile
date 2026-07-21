# syntax=docker/dockerfile:1

FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN addgroup --system medshelf \
    && adduser --system --ingroup medshelf medshelf \
    && mkdir -p /tmp/medshelf/uploads/leaflets \
    && chown -R medshelf:medshelf /tmp/medshelf

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/__init__.py /app/backend/__init__.py
COPY backend/app /app/backend/app
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

RUN chown -R medshelf:medshelf /app

USER medshelf
EXPOSE 10000

CMD ["sh", "-c", "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port \"${PORT:-10000}\""]
