# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage — resolve and install dependencies into /app/.venv
# ---------------------------------------------------------------------------
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev


# ---------------------------------------------------------------------------
# Runtime stage — just Python + the built venv + the app source.
# The database is NOT part of this image; point MYSQL__* at an external
# MySQL (see docker-compose.yml for a local one).
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    HTTP_PORT=8080

RUN groupadd --system app && useradd --system --gid app --home-dir /app app

COPY --from=build --chown=app:app /app /app

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen(f\"http://localhost:{os.environ['HTTP_PORT']}/health/internal\", timeout=2).status == 200 else 1)"

# exec form via sh so ${HTTP_PORT} is honoured while uvicorn stays PID 1
CMD ["sh", "-c", "exec uvicorn shougong.application.boot:app --host 0.0.0.0 --port ${HTTP_PORT}"]
