# HTTP API Reference

All routes live under the FastAPI app; in the Docker deployment nginx exposes them at `/api/...`.

## Endpoint map

### Health

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Aggregated health checks (MySQL + self HTTP) |
| `GET` | `/health/internal` | Cheap liveness probe used by the self-check |

### Dictionary

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/dictionary-entries?q=&limit=` | Search by simplified hanzi or pinyin |
| `GET` | `/dictionary-entries/{entry_id}` | Fetch one entry |

### Strokes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/characters/{character}/strokes` | Stroke paths + medians for one character |

### Study

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/study-items` | Enqueue one dictionary entry (`201` + `Location`) |
| `POST` | `/study-items/batch` | Import up to 1000 rows, per-row report |
| `GET` | `/study-items?due=&limit=&offset=` | List queue, optionally due only |
| `GET` | `/study-items/{item_id}` | Fetch one study item |
| `POST` | `/study-items/{item_id}/reviews` | Grade a due card (`201`) |
| `GET` | `/study-items/{item_id}/reviews` | Grade history, newest first |
| `POST` | `/study-items/{item_id}/priority` | Pin a learning item front/back, or move it to the other edge (upsert) |
| `DELETE` | `/study-items/{item_id}/priority` | Unpin an item (`204`, idempotent) |
| `GET` | `/study/session?kind=lesson\|review` | One request's lesson or review selection, in presentation order |
| `GET` | `/study-items/{item_id}/history` | Card-state snapshot trail, newest first |
| `GET` | `/study-items/history/learning-to-review` | Every learning -> review graduation row, newest first |

### Reading

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/reading-texts` | Generate + persist a vocabulary-restricted reading (`201`) |
| `GET` | `/reading-texts?limit=&offset=` | Saved readings, newest first |
| `GET` | `/reading-texts/models` | Model ids exposed by the LiteLLM proxy |
| `GET` | `/reading-vocabulary` | Known-word profiles + summary (HSK/POS/proficiency) |
| `GET` | `/reading-topics` | All scenario topics with active flags |
| `POST` | `/reading-topics` | Add a scenario (`201`) |
| `PATCH` | `/reading-topics/{topic_id}` | Set `active` true/false |
| `DELETE` | `/reading-topics/{topic_id}` | Remove a scenario (`204`) |

## Core DTOs

### `DictionaryEntryResponse`

```json
{
  "id": 123,
  "simplified": "学习",
  "pinyin": "xue2 xi2",
  "definitions": ["to study", "to learn"],
  "hsk_level": 1,
  "pos_tags": ["v", "n"]
}
```

### `StudyItemResponse`

```json
{
  "id": 42,
  "entry": { "id": 123, "simplified": "学习", "pinyin": "xue2 xi2", "definitions": [], "hsk_level": 1, "pos_tags": [] },
  "card": {
    "state": "learning",
    "due": "2026-09-11T00:00:00Z",
    "stability": 1.0,
    "difficulty": 5.2,
    "last_review": null
  },
  "created_at": "2026-09-11T12:00:00Z",
  "priority_position": null
}
```

`card.state` is one of `learning | review | relearning`.

`priority_position` is a nullable signed integer — an **opaque** display-ordering key, never rendered raw. It is `null` when the item is not pinned.

### Priority

Request: `{ "position": "front" | "back" }`. The endpoint is an upsert: it creates the pin or moves an already-pinned item to the requested edge, and answers `200` with the updated `StudyItemResponse`. `404` for an unknown item, `409` for an item whose card is not `learning`. `DELETE` answers `204` whether or not the item was pinned, and `404` only for an unknown item.

Priority is learning-only. Graduating an item from `learning` into `review` deletes its pin in the same transaction as the card update.

### Study session

`GET /study/session?kind=lesson|review` (kind required; an unknown value is `422`) returns:

```json
{
  "session_id": "0f6c2b9a4e5d4c8a9b1e2f3a4d5c6b7a",
  "kind": "lesson",
  "items": []
}
```

- **lesson** — every item whose card state is `learning`, with no due predicate. The pinned block leads, ascending by priority position then item id, and keeps that order unshuffled; only the unpinned remainder is shuffled.
- **review** — every due item that is not `learning` (`relearning` included). The whole block is shuffled, with no priority weighting.
- An empty selection is `200` with `items: []`. There is no pagination, limit or cursor.
- Nothing is persisted: no session row, seed or expiry. The response order is authoritative and the client must not re-sort. `session_id` is opaque and informational only — never an ordering input or a resume key; every request produces a fresh shuffle.

### Review request

```json
{ "rating": "again" }
```

Ratings: `again | hard | good | easy`. Response is `ReviewResponse` with the rescheduled item and the log entry.

### Batch import

Request: `{ "rows": [ { "hanzi": "学习", "pinyin": "xue2 xi2" } ] }` (1-1000 rows). Response:

```json
{
  "created": 1,
  "skipped": 0,
  "errors": 0,
  "outcomes": [
    {
      "row": 1,
      "hanzi": "学习",
      "pinyin": "xue2 xi2",
      "status": "created",
      "study_item_id": 42,
      "detail": null,
      "candidates": []
    }
  ]
}
```

`status` is `created | skipped | error`. An `error` row with `candidates` populated means the row was ambiguous or the pinyin did not match exactly; the client can offer those dictionary entries and resolve via `POST /study-items`.

### Reading tokens

`SavedReadingTextResponse` contains `tokens`, each either a word or punctuation:

```json
{
  "text": "学习",
  "is_word": true,
  "pinyin": "xue2 xi2",
  "definitions": ["to study"],
  "part_of_speech": "verb",
  "is_extra": false,
  "dictionary_entry_id": 123,
  "speaker": null
}
```

For dialogue readings, words carry a `speaker`; `speakers` at the reading level gives the cast and pinyin for first-use names.

## Error model

The app maps domain exceptions to a consistent problem shape:

```json
{ "code": "conflict", "detail": "study item 42 is not due until ..." }
```

| Status | Code | When |
| --- | --- | --- |
| `400` | `invalid_argument` | Invalid input caught by the service |
| `404` | `resource_not_found` | Unknown entry/item/character/topic |
| `409` | `conflict` | Duplicate queue entry, not-yet-due review, duplicate scenario |
| `422` | `domain_error` | Other domain failures (e.g. AI gateway failure) |
| `422` | FastAPI validation | Pydantic/query validation failures, unknown rating |

## Conventions

- **Pagination**: `limit` (defaults vary, caps at 100-200 depending on route) + `offset`. Clients page through until a short page is returned.
- **Ordering**: study items by due date then id; review/history newest first; readings newest first; a session response is authoritative to the client (pinned then shuffled for lessons, fully shuffled for reviews).
- **`Location` headers** are set on created resources.
- **Idempotency**: dictionary autoload and HSK enrichment are idempotent; adding the same entry twice is a conflict, not a duplicate insert.
- **Freshness**: reading history stores token text only and hydrates pinyin, definitions, and `dictionary_entry_id` on read against the current dictionary and study queue, so listed readings reflect the live vocabulary.

## Suggested additions

Endpoints that would unlock the interface proposals in [06-ui-ux-proposal.md](06-ui-ux-proposal.md) are catalogued separately in [07-api-gaps.md](07-api-gaps.md).
