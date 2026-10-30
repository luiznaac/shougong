# Code map

Module → key files → seam index for the `backend/` lane, plus the app entry points. FastAPI hexagonal service: `application → (httpapi|persistence|gateway|srs|segmentation) → usecase`; each package under `src/shougong/` is one block below, then the migration/test/build clusters. Vocabulary: **module**, **interface**, **seam**, **adapter**.

## Modules

### `usecase` — domain, ports and services
**Purpose**: the pure core — frozen dataclasses, `typing.Protocol` ports (`I*` prefix) and the services per slice: dictionary, study + SRS, strokes, reading/vocabulary, study-item history, plus `commons/` and the transaction port. It must not import `fastapi`, `sqlalchemy`, `httpx`, `uvicorn`, `pydantic`, `fsrs` or `jieba`; import-linter enforces it.
**Files**: `backend/src/shougong/usecase/dictionary/{model,pinyin,service,gateway}.py`; `usecase/study/{model,service,gateway,shuffler}.py`; `usecase/srs/{model,engine,day_boundary}.py`; `usecase/strokes/{model,service,gateway}.py`; `usecase/reading/{model,service,topic_service,vocabulary_service,gateway,dialogue,speakers,topics,proficiency,validation,working_set,vocabulary}.py`; `usecase/study_item_history/{model,service,gateway}.py`; `usecase/health/{checker,gateway}.py`; `usecase/configuration/transaction.py`; `usecase/commons/{asyncx,exceptions,logging,time}.py`
**Seam(s)**:
- **Ports (`I*` Protocol)** — `IDictionaryRepository`/`ICedictSource`/`IHskDatasetSource` (`dictionary/gateway.py`), `IStudyItemRepository` (`study/gateway.py`; `prioritise`/`deprioritise`/`list_for_session` above the `list` method that must stay last), `IShuffler` (`study/shuffler.py`), `ISrsEngine` (`srs/engine.py`), `IStrokeRepository`/`IHanziStrokeSource` (`strokes/gateway.py`), `IReadingTextGateway`/`ISegmenter`/`IReadingHistoryRepository`/`IReadingWordUsageRepository`/`IReadingTopicRepository` (`reading/gateway.py`), `IStudyItemHistoryRepository` (`study_item_history/gateway.py`), `IHealthChecker`/`IHealthGateway` (`health/`), `IClock` (`commons/time.py`). Every adapter explicitly inherits its port, so mypy and the IDE can jump port ↔ implementation.
- **`ITransactionTemplate.execute(...)`** (`usecase/configuration/transaction.py`) — lets a service compose several repository calls atomically without importing SQLAlchemy; nested calls join the outer transaction.
- **Domain errors** (`usecase/commons/exceptions.py`) — `DomainError` and its `InvalidArgumentError`/`ResourceNotFoundError`/`ConflictError` subclasses map to 4xx at `httpapi`'s exception handlers; nothing raises an HTTP type here.
- **Clock seam** (`usecase/commons/time.py`) — logic reads time through `IClock`, never `datetime.now()`; tests pass a fixed clock into `Container(settings, clock=...)`.
- **Reading behaviour** (`usecase/reading/`) — `ReadingService` orchestrates the LLM gateway + segmenter + repositories; the LLM prompt itself is the product-behaviour file `gateway/reading/system_prompt.txt`.
- **Queue priority and sessions** (`usecase/study/`) — `StudyService.prioritise`/`deprioritise`/`session`; the domain carries `priority_position` as an opaque key, and `IShuffler` is injected so ordering tests substitute a deterministic double instead of patching randomness.

### `persistence` — SQLAlchemy adapters and migrations
**Purpose**: async SQLAlchemy 2 repositories, one sub-package per usecase slice, over MySQL via `asyncmy`.
**Files**: `backend/src/shougong/persistence/configuration/{base,database,transaction}.py`; `persistence/dictionary/{entity,repository}.py`; `persistence/study/{entity,repository}.py`; `persistence/study_item_history/{entity,repository}.py`; `persistence/strokes/{entity,repository}.py`; `persistence/reading/{entity,topic_entity,word_usage_entity,repository,topic_repository,word_usage_repository}.py`; `persistence/health/mysql_health_check.py`
**Seam(s)**:
- **Declarative base** (`configuration/base.py`) — every entity module must be imported in `alembic/env.py` so `Base.metadata` is complete; there is no aggregate models module.
- **Transaction adapter** (`configuration/transaction.py`) — `SqlAlchemyTransactionTemplate` implements `ITransactionTemplate`; repositories obtain the bound session via `current_session()`, which raises outside a transaction.
- **Entity/repository seam** — a new table is a `persistence/<slice>/entity.py` + registration in `alembic/env.py`; a repository always receives the transaction template, never a session factory.
- **Priority edge maths** (`persistence/study/repository.py`) — `prioritise` reads the min/max position under `FOR UPDATE` and writes the pin in the same transaction; `update_card` deletes the pin on a `learning`→`review` graduation; `get`/`list`/`list_for_session` outer-join `study_item_priority` so `priority_position` is populated.
- **Health adapter** (`health/mysql_health_check.py`) — implements `IHealthChecker` over the shared engine and never raises.

### `gateway` — outbound HTTP integrations
**Purpose**: httpx adapters for CC-CEDICT, the HSK dataset, Hanzi Writer stroke data, the LiteLLM reading proxy and the self-health probe.
**Files**: `backend/src/shougong/gateway/configuration/http_client.py`; `gateway/dictionary/{cedict_source,hsk_dataset_source}.py`; `gateway/reading/litellm_reading_gateway.py`, `gateway/reading/system_prompt.txt`; `gateway/strokes/hanzi_writer_source.py`; `gateway/health/{app_health_gateway,http_client_health_check}.py`
**Seam(s)**:
- **Source adapters** — `CedictSource`/`HskDatasetSource` implement the dictionary sources; `HanziWriterSource` implements `IHanziStrokeSource`; `LiteLlmReadingGateway` implements `IReadingTextGateway`. All share `build_http_client()`.
- **Prompt seam** (`gateway/reading/system_prompt.txt`) — product behaviour, not config: changing it changes every generated reading, so review it like a usecase change.
- **Self-health** (`gateway/health/`) — `AppHealthGateway` probes `GATEWAYS__APP__HOST` (the service's own `/health/internal`); `HttpClientHealthCheck` adapts it to `IHealthChecker`.

### `srs` — FSRS scheduling adapter
**Purpose**: the FSRS engine adapter plus the day-boundary wrapper that fixes when cards become due.
**Files**: `backend/src/shougong/srs/fsrs_engine.py`; `backend/src/shougong/usecase/srs/day_boundary.py`
**Seam(s)**: **`FsrsEngine`** (`srs/fsrs_engine.py`) implements `ISrsEngine`; `DayBoundaryEngine` (`usecase/srs/day_boundary.py`) wraps it with the configured study timezone, so a scheduling change chooses deliberately which layer it lands in.

### `segmentation` — jieba adapter
**Purpose**: word segmentation and POS tagging for reading generation.
**Files**: `backend/src/shougong/segmentation/{jieba_segmenter,jieba_pos}.py`
**Seam(s)**: **`JiebaSegmenter`** (`segmentation/jieba_segmenter.py`) implements `ISegmenter`; `jieba_pos.py` adds POS tags. Import-linter keeps jieba out of `usecase/`.

### `randomization` — system-random adapter
**Purpose**: the production shuffle source for lesson/review sessions.
**Files**: `backend/src/shougong/randomization/random_shuffler.py`
**Seam(s)**: **`RandomShuffler`** implements `IShuffler` over `random.SystemRandom`; inject it through `Container`, and substitute a deterministic double in tests.

### `httpapi` — FastAPI controllers and DTOs
**Purpose**: the HTTP surface — controllers returning `APIRouter`s, Pydantic transport DTOs, the app factory and the domain-exception handlers.
**Files**: `backend/src/shougong/httpapi/controller/base.py`, `controller/{health,dictionary,strokes,study,study_session,study_item_history,reading,reading_topic,vocabulary}_controller.py`; `httpapi/schema.py`; `httpapi/configuration/server.py`
**Seam(s)**:
- **`IController.router()`** (`controller/base.py`) — the `ControllerTemplate` equivalent; `Container` builds the controller list and `build_app` mounts each router, so adding an endpoint never edits the server wiring.
- **DTO seam** (`schema.py`) — Pydantic lives only here (and in `application/settings.py`); every response has a `from_domain(...)` classmethod, and the shapes are mirrored in `frontend/src/api/types.ts` in the same commit.
- **Error mapping** (`configuration/server.py`) — `_install_exception_handlers` maps `ResourceNotFoundError`→404, `InvalidArgumentError`→400, `ConflictError`→409, `DomainError`→422 with the `{code, detail}` body.

### `application` — composition root and settings
**Purpose**: the one place that knows every concrete class, plus typed settings and the ASGI entry.
**Files**: `backend/src/shougong/application/{container,settings,boot}.py`
**Seam(s)**:
- **`Container`** (`application/container.py`) — builds the engine, HTTP client, every adapter/service (including the `RandomShuffler`) and the `controllers`/`health_checkers` lists, then `build_app(..., lifespan=...)`; adding a slice is a class plus one wiring line here. Tests construct their own `Container` with fakes/fixed clock.
- **Lifespan** (`application/container.py`) — the async lifespan starts the dictionary/HSK autoload and the jieba warm-up, and cancels them plus `aclose()` on shutdown.
- **Settings** (`application/settings.py`) — `pydantic-settings`, `__`-nested env vars, `APP_ENV` profile; `MySqlConfig.url` is the one DB URL shape.

### `alembic`, tests and packaging
**Purpose**: the migration chain and its baseline logic, the unit/integration suites, and the image/CI story.
**Files**: `backend/alembic/env.py`, `alembic/versions/{0001_baseline,0002_dictionary_hsk,0003_reading,0004_study_item_priority}.py`; `backend/scripts/migrate.py`; `backend/tests/unit/*`, `backend/tests/integration/*`, `tests/{conftest,fixtures}.py`; `backend/pyproject.toml`; `deploy/{entrypoint.sh,nginx.conf.template,supervisord.conf}`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/*`
**Seam(s)**:
- **Migration guard** (`alembic/env.py`, `scripts/migrate.py`) — autogenerate + `compare_metadata` against `Base.metadata`; `migrate.py` baselines a pre-migration database by stamping `0001_baseline`, then upgrades to head. Never hand-write SQL.
- **Deploy entry** (`deploy/entrypoint.sh`) — renders nginx, runs `scripts/migrate.py`, then `exec supervisord`; a failed migration aborts the container.
- **Layer contracts** (`pyproject.toml` `[tool.importlinter]`) — the `layers` + `forbidden` contracts are the enforcement behind the dependency rule; `uv run poe contracts` is part of `check`.
- **Test harness** (`tests/integration/conftest.py`) — Testcontainers MySQL + in-process ASGI via httpx + `pytest-httpserver`; `tests/unit/` needs no Docker.

## Entry points

- `backend/src/shougong/application/boot.py` — `app` (what uvicorn imports: `shougong.application.boot:app`) and `main()` (`poe run`).
- `backend/src/shougong/application/container.py` — the composition root; builds the object graph, controllers and FastAPI app.
- `backend/src/shougong/httpapi/configuration/server.py` — `build_app(...)`: mounts every `IController` router and installs the exception handlers.
- `backend/scripts/migrate.py` — the migration entry (`poe migrate`, `deploy/entrypoint.sh`); baseline-stamp then upgrade to head.
- `backend/alembic/env.py` — Alembic's online/offline environment over `Base.metadata`.
- `backend/tests/integration/conftest.py` — the integration harness entry (Testcontainers MySQL, in-process ASGI).
