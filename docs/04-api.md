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
  "created_at": "2026-09-11T12:00:00Z"
}
```

`card.state` is one of `learning | review | relearning`.

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
- **Ordering**: study items by due date then id; review/history newest first; readings newest first.
- **`Location` headers** are set on created resources.
- **Idempotency**: dictionary autoload and HSK enrichment are idempotent; adding the same entry twice is a conflict, not a duplicate insert.
- **Freshness**: reading history stores token text only and hydrates pinyin, definitions, and `dictionary_entry_id` on read against the current dictionary and study queue, so listed readings reflect the live vocabulary.

## Suggested additions

Endpoints that would unlock the interface proposals in [06-ui-ux-proposal.md](06-ui-ux-proposal.md) are catalogued separately in [07-api-gaps.md](07-api-gaps.md).
