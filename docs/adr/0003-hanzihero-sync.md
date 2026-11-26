---
status: accepted
date: 2026-11-23
---

# HanziHero sync: one-way CSV export over an in-app session login

shougong is a single-user, self-hosted Chinese handwriting SRS, and the learner already knows a large vocabulary on HanziHero. HanziHero exposes no public API and no OAuth, but it does ship an authenticated CSV export of the learner's known items per item type. We therefore sync one way, HanziHero → shougong: shougong logs in to HanziHero on the learner's behalf from a Settings screen, stores only the resulting session cookie, fetches the three simplified-course exports (`characters.csv`, `words.csv`, `my-dictionary.csv`), and enqueues each row as an ordinary study item through the existing batch import.

## Considered options

- **Public REST API** — none exists; the HanziHero team lists one only as a backlog idea.
- **OAuth or deeplink callback** — no OAuth provider exists, and the Phoenix session cookie is `HttpOnly` and domain-scoped, so shougong cannot receive it from a browser callback.
- **HTML list-page scraping** — the CSV export is the sanctioned, structured channel and is far less brittle.
- **Storing the username and password for silent re-login** — rejected to keep no password at rest; the cost is a manual reconnect when the session expires.
- **Marking items known but not drilled** — rejected; the learner wants these items in the study queue, and the existing import path already does exactly that.
- **Two-way sync or mirroring** — out of scope and destructive; the sync never deletes or updates.

## Consequences

- The import reuses `StudyService.import_batch`, so there is no new SRS or domain model; each imported row gets a fresh FSRS card and enters the lesson queue, and a re-sync is idempotent because already-queued entries are skipped.
- The reading engine's known vocabulary grows immediately, since it is exactly the set of entries that have a study item.
- HanziHero `skipped=true` rows are excluded.
- The session cookie is a bearer secret held in the database; it is the only credential stored.
- The sync depends on HanziHero's HTML login form and CSV shape, which can change without notice; a stale cookie surfaces a typed reconnect error.
- HanziHero's handpicked words are not all in CC-CEDICT, so unmatched rows are reported (with candidates) rather than resolved.
