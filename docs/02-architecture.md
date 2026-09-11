# Technical Architecture

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2 async, asyncmy, MySQL 8,
  FSRS (`py-fsrs`), jieba, Alembic, httpx, structlog, pydantic-settings.
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query,
  react-router, hanzi-writer.
- **Deployment**: one Docker image with supervisord running uvicorn + nginx;
  external MySQL; external LiteLLM proxy for AI.

## Hexagonal layering

The backend follows a layered hexagonal architecture. Dependencies point inward
and are enforced by import-linter in CI.

```mermaid
flowchart TB
    subgraph Edge["Edge (adapters)"]
        HTTP["httpapi: FastAPI controllers + Pydantic DTOs"]
        PERS["persistence: SQLAlchemy repositories"]
        GW["gateway: httpx outbound sources (CEDICT, HSK, Hanzi Writer, LiteLLM)"]
        SRS["srs: FSRS adapter"]
        SEG["segmentation: jieba adapter"]
    end
    subgraph Core["Core (usecase)"]
        DICT["dictionary slice"]
        STUDY["study / SRS slice"]
        STROKES["strokes slice"]
        READING["reading slice"]
        VOCAB["vocabulary / proficiency"]
        HIST["study item history"]
    end
    APP["application: composition root"]
    APP --> HTTP
    HTTP --> Core
    GW --> Core
    PERS --> Core
    SRS --> Core
    SEG --> Core
```

Rules that keep the architecture honest:

- `usecase/` contains frozen dataclasses, `typing.Protocol` ports (`I*`), and
  services. It must never import `fastapi`, `sqlalchemy`, `httpx`, `pydantic`,
  `uvicorn`, `fsrs`, or `jieba`.
- Pydantic DTOs live only in `httpapi/schema.py`; `application/settings.py`
  uses `pydantic-settings` for configuration.
- The composition root (`application/container.py`) knows every concrete class
  and wires the object graph; tests build their own containers with fakes.
- Adapters explicitly inherit their port interfaces so the IDE and mypy can
  jump between contract and implementation.

## Component inventory

| Slice | Domain | Ports | Adapters |
| --- | --- | --- | --- |
| Dictionary | CC-CEDICT entries, HSK metadata | `IDictionaryRepository`, `ICedictSource`, `IHskDatasetSource` | SQLAlchemy repo, MDBG/CC-CEDICT fetcher, HSK dataset fetcher |
| Study | study items, batch import, review loop | `IStudyItemRepository` | SQLAlchemy repo + history repo |
| SRS | FSRS card model and rating | `ISrsEngine` | `DayBoundaryEngine` + `FsrsEngine` |
| Strokes | per-character stroke order | `IStrokeRepository`, `IHanziStrokeSource` | SQLAlchemy cache, Hanzi Writer source |
| Reading | generation, working sets, topics, word usage | `IReadingTextGateway`, `ISegmenter`, `IReadingHistoryRepository`, `IReadingTopicRepository`, `IReadingWordUsageRepository` | LiteLLM gateway, jieba segmenter, SQLAlchemy repos |
| Vocabulary | grammatical overview and proficiency | `IStudyItemRepository`, `IDictionaryRepository` | derived on read, not persisted |
| Health | liveness/readiness | `IHealthChecker` | MySQL check, self-HTTP check |

## Startup and background work

```mermaid
sequenceDiagram
    participant U as uvicorn
    participant C as Container
    participant HTTP as httpx
    U->>C: build_app()
    C->>C: Build engine, repositories, services
    C->>C: Register controllers
    par Startup tasks
        C->>C: Autoload CC-CEDICT if empty
        C->>C: Enrich HSK + POS if not done
        C->>C: Warm up jieba
    end
```

Dictionary population is fire-and-forget: the API serves immediately and search
results appear once the background pass finishes. Both autoload passes are
idempotent and guarded by table state (`count() == 0` for CEDICT, any row with
`hsk_level` for enrichment).

## Key request flows

### Add a study item

```mermaid
sequenceDiagram
    participant C as Controller
    participant S as StudyService
    participant D as DictionaryRepository
    participant R as StudyItemRepository
    participant H as HistoryRepository
    participant K as StrokeService
    C->>S: add_item(entry_id)
    S->>D: get(entry_id)
    D-->>S: entry or None
    alt entry missing
        S-->>C: 404 ResourceNotFound
    else already queued
        S-->>C: 409 Conflict
    else valid
        S->>R: create(entry, new_card(now), now)
        R->>H: record(item, now)
        R-->>S: item
        S-->>C: 201 StudyItemResponse
        S-->>K: warm(character) fire-and-forget
    end
```

### Grade a review

```mermaid
sequenceDiagram
    participant C as Controller
    participant S as StudyService
    participant R as StudyItemRepository
    participant E as FSRS + DayBoundary
    participant H as HistoryRepository
    C->>S: review_item(item_id, rating)
    S->>R: get(item_id)
    alt not found
        S-->>C: 404
    else not due yet
        S-->>C: 409 conflict (no mutation)
    else due
        S->>E: review(card, rating, now)
        E-->>S: next card + review log
        S->>R: update_card(item_id, next_card, now)
        R->>H: record(updated, now)
        S->>R: add_review_log(item_id, log)
        S-->>C: 201 ReviewResponse
    end
```

## Deployment topology

```mermaid
flowchart LR
    User[Browser] --> Nginx[Nginx :WEB_PORT]
    Nginx --> SPA[Static SPA /var/www/shougong]
    Nginx -->|/api proxy| Uvicorn[Uvicorn :API_PORT]
    Uvicorn --> MySQL[External MySQL 8]
    Uvicorn --> LiteLLM[Self-hosted LiteLLM proxy]
    Uvicorn --> CEDICT[CC-CEDICT / MDBG]
    Uvicorn --> HSK[HSK 3.0 dataset]
    Uvicorn --> HZW[Hanzi Writer source]
```

- One image (`Dockerfile`) builds the SPA, resolves backend deps, then ships
  both processes under supervisord.
- `deploy/entrypoint.sh` renders the nginx config from a template, applies
  Alembic migrations, then starts supervisord. A failed migration aborts boot.
- The API is exposed directly on `API_PORT` (8080) and through nginx on
  `WEB_PORT` (8081) at `/api`.
- CI (`backend` + `frontend` jobs) gates the Docker publish job, which only runs
  on `master` pushes and pushes `luiznaac/shougong:latest` + `:v<run-number>`.

## Configuration

All configuration is environment-based (`pydantic-settings`); nested keys use
`__`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ENV` | `dev` | Controls JSON logging |
| `HTTP_PORT` | `8080` | uvicorn port |
| `MYSQL__*` | localhost | Database connection |
| `DICTIONARY_AUTOLOAD` | `true` | Fill CEDICT on boot if empty |
| `HSK_ENRICH_AUTOLOAD` | `true` | Stamp HSK/POS on boot if missing |
| `STUDY_TIMEZONE` | `UTC` | IANA timezone for the SRS day boundary |
| `GATEWAYS__APP__HOST` | `http://localhost:8080` | Self health-check base URL |
| `GATEWAYS__AI__BASE_URL` | `http://localhost:4000` | LiteLLM proxy |
| `GATEWAYS__AI__API_KEY` | `""` | LiteLLM auth |

## Quality gates

- Ruff lint + format (line length 120).
- mypy `--strict`.
- import-linter for architecture contracts.
- pytest: unit tests (no Docker) + integration tests (Testcontainers MySQL).
- Alembic `compare_metadata` guard in integration tests keeps entities and
  migrations in sync.
- Frontend `tsc -b` + Vite production build.

## Cross-cutting contract

`frontend/src/api/types.ts` is a hand-maintained mirror of
`backend/src/shougong/httpapi/schema.py`. Every DTO change must update both
sides in the same commit; this is the reason both projects live in one monorepo.
