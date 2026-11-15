"""`StrokeService` — per-character stroke data, cached lazily on first lookup."""

from __future__ import annotations

from shougong.usecase.commons.asyncx import fire_and_forget
from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.request_context import job_context
from shougong.usecase.strokes.gateway import IHanziStrokeSource, IStrokeRepository
from shougong.usecase.strokes.model import CharacterStrokes
from shougong.usecase.strokes.telemetry import StrokesTelemetry


class StrokeService:
    def __init__(
        self,
        repository: IStrokeRepository,
        source: IHanziStrokeSource,
        telemetry: StrokesTelemetry,
    ) -> None:
        self._repository = repository
        self._source = source
        self._telemetry = telemetry

    async def get(self, character: str) -> CharacterStrokes:
        cached = await self._repository.find(character)
        if cached is not None:
            if cached.strokes is not None:
                self._telemetry.lookup_hit()
                return cached.strokes
            # Negative cache hit: still 404 for *this* caller — don't make a
            # page view wait on a network round trip for a character that
            # already failed once — but retry in the background. The earlier
            # miss could have been a transient warm-up failure, or this could
            # be a "legacy" character added before warming existed and never
            # looked up until just now for an unrelated reason. A successful
            # retry only helps the next view, not this one.
            self._telemetry.lookup_missed()
            fire_and_forget(self.warm(character))
            raise ResourceNotFoundError("character_strokes", character)

        return await self._fetch_and_cache(character)

    async def warm(self, character: str) -> None:
        """Best-effort cache warm-up: fetch (or retry a prior negative result)
        and cache, but never raise.

        Meant to run as a fire-and-forget background task (see
        `commons.asyncx.fire_and_forget`) — right after a character enters
        the study queue, so its stroke data is already cached by the time the
        learner looks at it, and also as the retry `get` schedules when it
        finds a negative cache entry. The task boundary owns the `job.id`.
        """
        with job_context():
            cached = await self._repository.find(character)
            if cached is not None and cached.strokes is not None:
                return  # already have good data — nothing to do
            try:
                await self._fetch_and_cache(character)
            except ResourceNotFoundError:
                pass  # a confirmed miss is the counter's job, not a record
            except Exception as error:
                self._telemetry.warm_failed(error)

    async def _fetch_and_cache(self, character: str) -> CharacterStrokes:
        """Unconditionally fetch from the source and cache the result (hit or
        miss) — no cache read first. Callers decide when a fetch is warranted.
        """
        fetched = await self._source.fetch(character)
        await self._repository.save(character, fetched)
        if fetched is None:
            self._telemetry.lookup_missed()
            raise ResourceNotFoundError("character_strokes", character)
        self._telemetry.lookup_fetched()
        return fetched
