# Proposed API Additions

These endpoints are suggestions to support the desktop interface proposals in [06-ui-ux-proposal.md](06-ui-ux-proposal.md). They are not part of the current API; each one follows the existing hexagonal pattern: domain model + port + service + controller + DTO mirror in `frontend/src/api/types.ts`.

## Priority map

| # | Endpoint | Priority | Unlocks |
| --- | --- | --- | --- |
| 1 | ~~`GET /dashboard`~~ → `GET /study/overview` | Done | Today hub without client-side aggregation |
| 2 | ~~`GET /study-items` filters~~ | Done | Library, board, batch views (shipped with the list envelope) |
| 3 | `DELETE /study-items/{id}` | High | Queue management (remove item) |
| 4 | `PATCH /study-items/{id}` | Medium | Pause/reschedule an item |
| 5 | ~~`GET /reading-texts/{id}`~~ | Done | Deep links and single-reading views — implemented with the summary list and `entry_id` filter |
| 6 | `GET /review-logs` | Medium | Global accuracy/streak analytics |
| 7 | `POST /characters/strokes/batch` | Medium | Preload stroke data for sessions |
| 8 | ~~`GET /dictionary-entries/{id}/related`~~ | Done | Shared-character family with `study_item_id` (see below) |
| 9 | ~~`GET /study-items/next`~~ | Superseded | Session endpoint (`GET /study/session`) covers lean quiz clients |

## 1. `GET /study/overview` — shipped

The dashboard aggregate shipped as `GET /study/overview` (renamed from the
`/dashboard` proposal; see [04-api.md](04-api.md#study-overview)). The settled
shape drops the client-only `vocabulary`, `last_reading` and `recently_graduated`
fields, replaces the state distribution with the five-group `srs_distribution`,
and adds the cumulative `learned` curve; the forecast is seven local days starting
tomorrow and excludes overdue and learning items.

## 2. Filtering on `GET /study-items`

**Done** in the list-contract build ticket: `GET /study-items` accepts the parameters
below, returns the `{ items, total, limit, offset }` envelope, and
`GET /dictionary-entries` gained `offset` plus the same envelope. The encoding below
is the original proposal; the settled semantics (repeatable params, three sorts,
leech ordering) are in [04-api.md](04-api.md#study-item-list).

Before this change the endpoint supported only `due`, `limit`, and `offset`. The Library and Board views needed:

```text
GET /study-items?state=learning,review&hsk_level=1,2&pos_tag=verb
                 &search=学&due_from=2026-09-11&due_to=2026-09-18
                 &sort=due_asc&limit=100&offset=0
```

Recommended fields: `state` (repeatable or comma-separated), `hsk_level` (repeatable), `pos_tag`, `search` (simplified or pinyin substring), `due_from`, `due_to`, `sort` (`due_asc` default, `created_desc`, `stability_asc`).

## 3. `DELETE /study-items/{id}`

Queue management requires removing an item a learner no longer wants. The endpoint should cascade-delete review logs and history (or archive instead, if analytics retention matters), return `204`, and 404 for unknown items.

## 4. `PATCH /study-items/{id}`

Optional scheduling controls:

```json
{ "due": "2026-09-18T00:00:00Z", "paused": true }
```

`paused=true` removes the item from due queries without deleting data; a due override lets a learner defer one card explicitly. Both should record history snapshots.

## 5. `GET /reading-texts/{id}` — done

Implemented: the list route now returns summary rows, and `GET /reading-texts/{id}` returns the full reading with the same hydration behaviour and `404` for an unknown id (see [04-api.md](04-api.md) → Reading summary list).

## 6. `GET /review-logs` - global grade history

Analytics across the whole queue:

```text
GET /review-logs?from=2026-09-01&to=2026-09-11&limit=200&offset=0
```

Response rows: `{ study_item_id, entry, rating, review_datetime }`. Client-side aggregation then powers accuracy over time, rating distributions, streaks, and forgetting curves without loading every item's history.

## 7. `POST /characters/strokes/batch`

Quiz sessions and multi-character words need stroke data for several characters at once. Today the client issues one request per character. A batch endpoint (or `GET /characters/strokes?chars=学,习`) returns a map keyed by character, reusing the same cache/negative-cache behavior.

## 8. `GET /dictionary-entries/{id}/related` — implemented

Shipped as `GET /dictionary-entries/{entry_id}/related?limit=&offset=` (see
[04-api.md](04-api.md)): related = an entry whose `simplified` shares at least one hanzi
with the target's, excluding the target and every entry with the same `simplified`.
Ordered by distinct shared hanzi `DESC`, then `hsk_level ASC NULLS LAST`, then
`char_length(simplified) ASC`, then `id ASC`; paginated with `{ items, total, limit,
offset }` and each row carrying the study item's id (`study_item_id`, or `null`).

## 9. `GET /study-items/next?mode=lesson|review` — superseded

**Superseded by `GET /study/session?kind=lesson|review`** (see [04-api.md](04-api.md#study-session)). The session endpoint returns the whole selection in presentation order — pinned-first unshuffled lessons and fully shuffled reviews — so the browser never has to hold or re-sort the queue itself, while the backend remains authoritative about ordering. There is deliberately no one-card-at-a-time cursor: the session response is the selection, and no session state is persisted.

## Non-endpoint suggestions

- **Server-computed SRS level hints**: the client currently derives Novice/Apprentice/Journeyman/Expert/Master from `stability`. For consistency across future clients, consider a read-only presentation field (or separate ladder endpoint) derived in one place.
- **Pagination metadata**: done — the `{ items, total, limit, offset }` envelope ships on the redesign's list routes (see [04-api.md](04-api.md#list-envelope)).
