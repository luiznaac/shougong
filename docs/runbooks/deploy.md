# Deploy runbook — shougong

How to run and publish the combined backend + SPA image. The [README](../../README.md) Quickstart covers the dev stack; this runbook covers the container and the Docker Hub publish the Quickstart cannot perform.

## Image layout

One multi-stage image (repo-root `Dockerfile`) ships both processes under `supervisord`:

- `uvicorn` serves the API on `API_PORT` (`8080`, fixed inside the container).
- `nginx` serves the built SPA on `WEB_PORT` (`8081`, fixed) and reverse-proxies `/api` to uvicorn.

The database is not in the image, and `MYSQL__PORT` is pinned to `3306` for the external database. The schema comes from `backend/alembic/versions/*.py`, applied by `python scripts/migrate.py` from `deploy/entrypoint.sh` before the app starts.

## Run the full stack locally

The app runs as `APP_ENV=prod`, so it requires an OTLP endpoint and fails its boot loudly without one. Export the endpoint (a Collector on the host is `http://host.docker.internal:4318`), then start the app and MySQL together:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
docker compose up --build
```

The UI is on `http://localhost:8131` and the API on `http://localhost:8130`. For just the database (host `:8132`), run `docker compose up -d mysql`.

## Run against an external database

```bash
docker run --rm -p 8130:8080 -p 8131:8081 \
  -e MYSQL__HOST=host.docker.internal -e MYSQL__PORT=3306 -e MYSQL__DATABASE=shougong \
  -e MYSQL__USER=root -e MYSQL__PASSWORD= \
  luiznaac/shougong:latest
```

The published host ports are configurable with `HTTP_PORT` and `WEB_HOST_PORT`; inside the container the app still listens on `8080` and nginx on `8081`.

## Publish

A merge to `master` never publishes. `.github/workflows/docker-publish.yml` publishes
`luiznaac/shougong` only on a deliberate `v*` release tag, pushed by `scripts/release.sh <version>`:
it tags immutable semver, major.minor and short-SHA images, moving `latest` only on a release. On a
pull request it builds the same image with `push: false`, so a broken Dockerfile fails CI before a
release discovers it. Publishing needs the repository variable `DOCKERHUB_USERNAME` and secret
`DOCKERHUB_TOKEN`.
