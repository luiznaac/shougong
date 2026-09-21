# shougong Documentation

This folder is the living documentation for the `shougong` (手工) monorepo: a Chinese handwriting trainer with a spaced-repetition engine and vocabulary- restricted AI reading practice.

| Doc | What it covers |
| --- | --- |
| [01-business.md](01-business.md) | Product intent, personas, business goals, and the core user workflows |
| [02-architecture.md](02-architecture.md) | Hexagonal architecture, components, startup flow, deployment, and quality gates |
| [03-data-model.md](03-data-model.md) | Relational schema, entities, and the FSRS scheduling model |
| [04-api.md](04-api.md) | HTTP API surface, DTO shapes, errors, and pagination conventions |
| [05-reading-engine.md](05-reading-engine.md) | How AI reading texts are generated, constrained, validated, and persisted |
| [06-ui-ux-proposal.md](06-ui-ux-proposal.md) | Desktop-first interface options, information architecture, and interaction patterns |
| [07-api-gaps.md](07-api-gaps.md) | Proposed new endpoints to support richer web interfaces |

The docs describe the **stack and capabilities** as they exist today. The UI proposal deliberately ignores the current React implementation and designs for the backend API plus the frontend stack (React + Vite + TypeScript + Tailwind + hanzi-writer).

## Reading order

1. Start with [01-business.md](01-business.md) to understand what the product does and which workflows matter.
2. Read [02-architecture.md](02-architecture.md) and [03-data-model.md](03-data-model.md) for the technical foundation.
3. Use [04-api.md](04-api.md) as the API reference and [05-reading-engine.md](05-reading-engine.md) for the AI reading pipeline.
4. Finish with the interface strategy in [06-ui-ux-proposal.md](06-ui-ux-proposal.md) and the endpoint backlog in [07-api-gaps.md](07-api-gaps.md).

## Repo map

| Path | Role |
| --- | --- |
| `backend/` | FastAPI hexagonal service, SQLAlchemy/MySQL, FSRS, stroke cache, AI reading gateway |
| `frontend/` | React + Vite SPA; its `src/api/types.ts` mirrors `backend/src/shougong/httpapi/schema.py` |
| `deploy/` | Nginx template, supervisord config, container entrypoint |
| `docs/` | This documentation set |

> Cross-cutting contract: every response/request DTO in the backend schema must be mirrored in `frontend/src/api/types.ts` in the same change.
