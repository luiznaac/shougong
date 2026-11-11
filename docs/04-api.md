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
| `GET` | `/dictionary-entries?q=&limit=&offset=` | One page of matches (envelope), shortest-first |
| `GET` | `/dictionary-entries/{entry_id}` | Fetch one entry |
| `GET` | `/dictionary-entries/{entry_id}/related?limit=&offset=` | Shared-character family, most-shared first |

### Strokes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/characters/{character}/strokes` | Stroke paths + medians for one character |

### Study

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/study-items` | Enqueue one dictionary entry (`201` + `Location`) |
| `POST` | `/study-items/batch` | Import up to 1000 rows, per-row report |
| `GET` | `/study-items?due=&leech=&state=&hsk_level=&pos_tag=&search=&due_from=&due_to=&sort=&limit=&offset=` | One page of the filtered queue (envelope); a leech list stays worst-first unless `sort` is given |
| `GET` | `/study-items/{item_id}` | Fetch one study item |
| `POST` | `/study-items/{item_id}/reviews` | Grade a due card (`201`) |
| `GET` | `/study-items/{item_id}/reviews` | Grade history, newest first |
| `POST` | `/study-items/{item_id}/priority` | Pin a learning item front/back, or move it to the other edge (upsert) |
| `DELETE` | `/study-items/{item_id}/priority` | Unpin an item (`204`, idempotent) |
| `GET` | `/study/session?kind=lesson\|review` | One request's lesson or review selection, in presentation order |
| `GET` | `/study-items/{item_id}/history` | Card-state snapshot trail, newest first |
| `GET` | `/study-items/history/learning-to-review` | Every learning -> review graduation row, newest first |
| `GET` | `/study/insights/extra-study?from=&to=` | Recent failures and graduations in an instant range |
| `GET` | `/study/overview?tz_offset_minutes=` | Dashboard aggregate: counts, SRS distribution, 7-day forecast, learned curve |

### Reading

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/reading-texts` | Generate + persist a vocabulary-restricted reading (`201`) |
| `GET` | `/reading-texts?entry_id=&limit=&offset=` | Reading summary page, newest first; optional entry filter with a match snippet |
| `GET` | `/reading-texts/{reading_id}` | Fetch one full reading (`SavedReadingTextResponse`) |
| `GET` | `/reading-texts/models` | Model ids exposed by the LiteLLM proxy |
| `GET` | `/reading-vocabulary` | Known-word profiles + summary (HSK/POS/proficiency) |
| `GET` | `/reading-topics` | All scenario topics with active flags |
| `POST` | `/reading-topics` | Add a scenario (`201`) |
| `PATCH` | `/reading-topics/{topic_id}` | Set `active` true/false |
| `DELETE` | `/reading-topics/{topic_id}` | Remove a scenario (`204`) |

## Core DTOs

### List envelope

The redesign's list routes wrap their rows in one page shape — live today on
`GET /study-items` and `GET /dictionary-entries`, and specified for the
related-entries and reading lists when they land:

```json
{ "items": [], "total": 137, "limit": 20, "offset": 0 }
```

`total` is the exact count of the filtered set; zero results is `200` with
`items: []`. `limit` is `1..100` (default `20`) and `offset >= 0` (default `0`).
The page's order is authoritative and the server has no "load more" mode — that is
client presentation. `GET /study-items/{id}/reviews` and
`GET /study-items/{id}/history` stay bare arrays.

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

### `RelatedEntryResponse`

`DictionaryEntryResponse` plus the id of the study item queuing the word (`null` when it
is not queued):

```json
{
  "id": 124,
  "simplified": "知识",
  "pinyin": "zhi1 shi5",
  "definitions": ["knowledge"],
  "hsk_level": 1,
  "pos_tags": ["n"],
  "study_item_id": null
}
```

### `RelatedEntriesResponse`

The pagination envelope shared by the redesign's list routes (`{ items, total, limit, offset }`);
`total` is the whole filtered set, not the page length.

```json
{ "items": [], "total": 5, "limit": 20, "offset": 0 }
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
  "priority_position": null,
  "is_leech": false
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

`is_leech` is derived on every read, never stored: an item is a leech when three
or more of its ten most recent review-log entries carry `again`. It is annotated
on the study-item list, the single study item, the study session, the Extra Study
buckets and the `leech=true` list. Review and history responses always carry
`false`.

### Study item list

`GET /study-items` returns one page of the filtered queue inside the list envelope.
Every parameter is optional; values within one parameter OR, different parameters
AND.

| Param | Encoding | Semantics |
| --- | --- | --- |
| `due` | bool, default `false` | Shorthand for `due_to = now`; with an explicit `due_to`, the earlier bound wins. |
| `leech` | bool, default `false` | 3+ `again` in the last ten review logs; keeps worst-first order unless `sort` is given. |
| `state` | repeatable `learning\|review\|relearning` | Any-of. |
| `hsk_level` | repeatable `1..9` or `none` | Any-of; `none` = `hsk_level IS NULL`. |
| `pos_tag` | repeatable raw HSK/ICTCLAS tag (`v`, `n`) | Any-of; matches when the entry's `pos_tags` intersects the set. |
| `search` | trimmed string, min 1 | Case-insensitive substring over `simplified` or `pinyin`. |
| `due_from` | ISO instant | Inclusive; `card.due >= due_from`. |
| `due_to` | ISO instant | Exclusive; `card.due < due_to`. |
| `sort` | `due_asc` (default) \| `created_desc` \| `stability_asc` | See below. |

Sorts: `due_asc` = `card_due ASC, id ASC`; `created_desc` = `created_at DESC, id
DESC`; `stability_asc` = `card_stability ASC NULLS LAST, id ASC`. `leech=true`
without `sort` orders by `again` count descending, then most recent failure
descending, then item id ascending; an explicit `sort` overrides the leech ordering
but not the leech filter. `priority_position` is never an ordering input.

`GET /dictionary-entries?q=` applies the same envelope and window, keeping its
`char_length(simplified) ASC, id ASC` order; `total` counts every entry matching
`q`.

### Extra Study

`GET /study/insights/extra-study?from=&to=` takes two required instants: `from` is
inclusive, `to` exclusive. The browser sends the learner's local-day boundaries;
the backend validates only the range shape (missing, inverted or longer than 32
days is a `422`). Both buckets are always present, each with a true total and at
most 200 items.

```json
{
  "from": "2026-09-01T03:00:00Z",
  "to": "2026-09-04T03:00:00Z",
  "recent_mistakes": {
    "total": 2,
    "items": [ { "id": 42, "entry": {}, "card": {}, "created_at": "…", "is_leech": true } ]
  },
  "recently_learned": {
    "total": 1,
    "items": [ { "id": 7, "entry": {}, "card": {}, "created_at": "…", "is_leech": false } ]
  }
}
```

- **Recent Mistakes**: items whose current state is `review` or `relearning` and
  that have at least one in-range `again`, deduped per item, most recent failure
  first. Card state is evaluated now, so an item that graduated out of the
  excluded states drops out.
- **Recently Learned**: items whose learning-to-review transition row landed in
  range, newest transition first.

### Study overview

`GET /study/overview?tz_offset_minutes=<int>` is the dashboard's one-read
aggregate: queue counts, the SRS display distribution, a seven-day forecast and
the learned curve. `tz_offset_minutes` defaults to `0`, accepts `-840..840`, and
is minutes **east** of UTC (the client sends `-new Date().getTimezoneOffset()`).
It affects only day bucketing; due counts compare against the server's now. No
pagination and no mutation.

```json
{
  "new_count": 3,
  "due_count": 24,
  "due_review_count": 21,
  "due_learning_count": 3,
  "item_count": 57,
  "leech_count": 4,
  "srs_distribution": { "novice": 6, "apprentice": 15, "journeyman": 2, "expert": 0, "master": 0 },
  "next_seven_days": [{ "date": "2026-11-12", "due": 8 }],
  "learned": { "total": 45, "points": [{ "date": "2026-09-18", "count": 1 }] }
}
```

- **new_count** — every `learning` item (the lesson queue; no due predicate).
- **due_count** — every item with `card.due <= now`.
- **due_review_count** — due items whose state is not `learning` (`review` +
  `relearning`); **due_learning_count** — due `learning` items, a subset of
  `new_count`.
- **item_count** / **leech_count** — all items / all leeches.
- **srs_distribution** — every item grouped by `stability` days: `≤4` novice,
  `≤14` apprentice, `≤60` journeyman, `≤365` expert, else master; a missing
  stability counts as zero.
- **next_seven_days** — exactly seven rows starting **tomorrow** in the learner's
  local calendar; each counts **non-learning** items whose `card.due` falls in
  `[local midnight, next midnight)`. Overdue items are not in the forecast — they
  live in `due_review_count`.
- **learned** — learning→review transitions from the first transition's local day
  through today, one cumulative point per day (flat on empty days); `total` is
  the graduation count. No transitions → `total: 0`, `points: []`.

`tz_offset_minutes` outside the range is a `422`.

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

### Reading summary list

`GET /reading-texts` returns a page of summary rows — never the token/attempt payload — inside the shared envelope:

```json
{
  "items": [
    {
      "id": 204,
      "format": "dialogue",
      "topic": "No restaurante",
      "topic_generated": false,
      "model": "openai/gpt-4.1-mini",
      "extra_word_count": 1,
      "token_count": 96,
      "attempt_count": 2,
      "created_at": "2026-11-02T19:12:00Z",
      "preview": "服务员：这个菜很辣。我：知道了，谢谢！…",
      "match": null
    }
  ],
  "total": 38,
  "limit": 8,
  "offset": 0
}
```

- `limit` is `1..100` (default `20`), `offset` is `>= 0`; `total` is the exact count of the filtered set.
- `extra_word_count` is the chosen draft's own count (`attempt_count` is `1` on rows written before the correction loop); `token_count` counts words and punctuation; `preview` is the first 48 characters of the concatenated token text.
- **`entry_id` filter** (optional int): only readings containing a word token that resolves to that dictionary entry under the same hydration rule used on read (the studied reading wins, else the dictionary's first candidate by id); extra words included. An unknown id is `200` with an empty page, not `404`.
- With `entry_id`, each row also carries `match: { "before", "hit", "after" }` — the first occurrence's token slice, punctuation included, up to 12 tokens each side and clamped to the article edges. Without it, `match` is `null`.
- `GET /reading-texts/{reading_id}` returns the full `SavedReadingTextResponse` (hydration included) and `404`s for an unknown id.

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

- **Pagination**: list routes return `{ items, total, limit, offset }` (`/reading-texts`, `/study-items`, `/dictionary-entries`); `limit` is `1..100` (default `20`), `offset` is `>= 0`, `total` is the exact filtered count. Item reviews and item history keep their bare arrays (`limit` 1..200 default 50). Clients page explicitly and never re-sort a page.
- **Ordering**: study items by due date then id unless a filter/sort overrides it (`leech=true` orders worst-first, `sort` selects `created_desc` or `stability_asc`); dictionary search shortest-first; review/history newest first; readings newest first; a session response is authoritative to the client (pinned then shuffled for lessons, fully shuffled for reviews).
- **`Location` headers** are set on created resources.
- **Idempotency**: dictionary autoload and HSK enrichment are idempotent; adding the same entry twice is a conflict, not a duplicate insert.
- **Freshness**: reading history stores token text only and hydrates pinyin, definitions, and `dictionary_entry_id` on read against the current dictionary and study queue, so listed readings reflect the live vocabulary.

## Suggested additions

Endpoints that would unlock the interface proposals in [06-ui-ux-proposal.md](06-ui-ux-proposal.md) are catalogued separately in [07-api-gaps.md](07-api-gaps.md).
