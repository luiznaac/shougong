# Proposed API Additions

These endpoints are suggestions to support the desktop interface proposals in
[06-ui-ux-proposal.md](06-ui-ux-proposal.md). They are not part of the current
API; each one follows the existing hexagonal pattern: domain model + port +
service + controller + DTO mirror in `frontend/src/api/types.ts`.

## Priority map

| # | Endpoint | Priority | Unlocks |
| --- | --- | --- | --- |
| 1 | `GET /dashboard` | High | Today hub without client-side aggregation |
| 2 | `GET /study-items` filters | High | Library, board, batch views |
| 3 | `DELETE /study-items/{id}` | High | Queue management (remove item) |
| 4 | `PATCH /study-items/{id}` | Medium | Pause/reschedule an item |
| 5 | `GET /reading-texts/{id}` | Medium | Deep links and single-reading views |
| 6 | `GET /review-logs` | Medium | Global accuracy/streak analytics |
| 7 | `POST /characters/strokes/batch` | Medium | Preload stroke data for sessions |
| 8 | `GET /dictionary-entries/{id}/related` | Low | Related entries without client search |
| 9 | `GET /study-items/next` | Medium | Lean quiz clients (one card at a time) |

## 1. `GET /dashboard` - aggregate today state

The current client fetches all study items and learning-to-review history to
compute lesson/review counts, SRS distribution, and upcoming due dates. A
server-side summary keeps the day-boundary logic authoritative and reduces the
payload.

```json
{
  "now": "2026-09-11T12:00:00Z",
  "new_count": 3,
  "due_count": 24,
  "due_review_count": 21,
  "due_learning_count": 3,
  "srs_distribution": { "learning": 6, "review": 15, "relearning": 2 },
  "next_seven_days": [
    { "date": "2026-09-11", "due": 24 },
    { "date": "2026-09-12", "due": 8 },
    { "date": "2026-09-13", "due": 6 }
  ],
  "vocabulary": { "known_count": 45, "estimated_hsk_level": 2 },
  "last_reading": { "id": 7, "format": "paragraph", "created_at": "..." },
  "recently_graduated": [
    { "study_item_id": 9, "entry": { "simplified": "学习" }, "created_at": "..." }
  ]
}
```

## 2. Filtering on `GET /study-items`

Today the endpoint supports only `due`, `limit`, and `offset`. The Library and
Board views need:

```text
GET /study-items?state=learning,review&hsk_level=1,2&pos_tag=verb
                 &search=学&due_from=2026-09-11&due_to=2026-09-18
                 &sort=due_asc&limit=100&offset=0
```

Recommended fields: `state` (repeatable or comma-separated), `hsk_level`
(repeatable), `pos_tag`, `search` (simplified or pinyin substring), `due_from`,
`due_to`, `sort` (`due_asc` default, `created_desc`, `stability_asc`).

## 3. `DELETE /study-items/{id}`

Queue management requires removing an item a learner no longer wants. The
endpoint should cascade-delete review logs and history (or archive instead, if
analytics retention matters), return `204`, and 404 for unknown items.

## 4. `PATCH /study-items/{id}`

Optional scheduling controls:

```json
{ "due": "2026-09-18T00:00:00Z", "paused": true }
```

`paused=true` removes the item from due queries without deleting data; a due
override lets a learner defer one card explicitly. Both should record history
snapshots.

## 5. `GET /reading-texts/{id}`

The list endpoint returns full objects, but deep links and per-reading views
benefit from a single-resource fetch, including 404 semantics and the same
hydration behavior.

## 6. `GET /review-logs` - global grade history

Analytics across the whole queue:

```text
GET /review-logs?from=2026-09-01&to=2026-09-11&limit=200&offset=0
```

Response rows: `{ study_item_id, entry, rating, review_datetime }`. Client-side
aggregation then powers accuracy over time, rating distributions, streaks, and
forgetting curves without loading every item's history.

## 7. `POST /characters/strokes/batch`

Quiz sessions and multi-character words need stroke data for several characters
at once. Today the client issues one request per character. A batch endpoint
(or `GET /characters/strokes?chars=学,习`) returns a map keyed by character,
reusing the same cache/negative-cache behavior.

## 8. `GET /dictionary-entries/{id}/related`

The item page currently derives related entries by searching the dictionary
for the character and filtering client-side. A server endpoint would return
entries sharing any character in `simplified`, excluding the item itself, with
`is_studied` flags.

## 9. `GET /study-items/next?mode=lesson|review`

For lean quiz clients: return one due item at a time with a stable session
token, so the browser never holds the whole queue and the backend can enforce
due-ness and skip 409 races. Response: the next `StudyItemResponse` plus
`remaining_count` and optional `session_id`.

## Non-endpoint suggestions

- **Server-computed SRS level hints**: the client currently derives
  Novice/Apprentice/Journeyman/Expert/Master from `stability`. For consistency
  across future clients, consider a read-only presentation field (or separate
  ladder endpoint) derived in one place.
- **Pagination metadata**: `X-Total-Count` or a `{ items, total, limit,
  offset }` envelope would remove the "page until short page" client pattern.
