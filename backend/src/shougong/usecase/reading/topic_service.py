"""`ReadingTopicService` — manage the editable scenario list drawn from when the
free-text topic is blank."""

from __future__ import annotations

from shougong.usecase.commons.exceptions import ConflictError, InvalidArgumentError, ResourceNotFoundError
from shougong.usecase.commons.time import IClock
from shougong.usecase.reading.gateway import IReadingTopicRepository
from shougong.usecase.reading.model import ReadingTopic

_MAX_SCENARIO_LEN = 255


class ReadingTopicService:
    def __init__(self, repository: IReadingTopicRepository, clock: IClock) -> None:
        self._repository = repository
        self._clock = clock

    async def list(self) -> list[ReadingTopic]:
        return await self._repository.list_all()

    async def add(self, scenario: str) -> ReadingTopic:
        cleaned = scenario.strip()
        if not cleaned:
            raise InvalidArgumentError("scenario must not be empty")
        if len(cleaned) > _MAX_SCENARIO_LEN:
            raise InvalidArgumentError(f"scenario must be at most {_MAX_SCENARIO_LEN} characters")
        if any(cleaned.lower() == t.scenario.lower() for t in await self._repository.list_all()):
            raise ConflictError(f"scenario already exists: {cleaned}")
        return await self._repository.add(cleaned, self._clock.now())

    async def set_active(self, topic_id: int, active: bool) -> ReadingTopic:
        updated = await self._repository.set_active(topic_id, active)
        if updated is None:
            raise ResourceNotFoundError("reading_topic", str(topic_id))
        return updated

    async def delete(self, topic_id: int) -> None:
        await self._repository.delete(topic_id)
