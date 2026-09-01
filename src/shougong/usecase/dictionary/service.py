"""`DictionaryService` — search/lookup plus CC-CEDICT (re)population."""

from __future__ import annotations

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.logging import get_logger
from shougong.usecase.dictionary.gateway import ICedictSource, IDictionaryRepository
from shougong.usecase.dictionary.model import DictionaryEntry

_log = get_logger(__name__)


class DictionaryService:
    def __init__(self, repository: IDictionaryRepository) -> None:
        self._repository = repository

    async def search(self, query: str, limit: int = 20) -> list[DictionaryEntry]:
        entries = await self._repository.search(query.strip(), limit)
        _log.info("dictionary.searched", query=query, count=len(entries))
        return entries

    async def get(self, entry_id: int) -> DictionaryEntry:
        entry = await self._repository.get(entry_id)
        if entry is None:
            raise ResourceNotFoundError("dictionary_entry", str(entry_id))
        return entry

    async def populate_if_empty(self, source: ICedictSource) -> int:
        """Download CC-CEDICT and fill the table, but only if it is empty.

        Idempotent: once loaded, every later call is a no-op. Runs from the
        startup hook in the composition root.
        """
        existing = await self._repository.count()
        if existing > 0:
            _log.info("dictionary.populate.skipped", existing=existing)
            return 0

        _log.info("dictionary.populate.started")
        records = await source.fetch()
        added = await self._repository.bulk_add(records)
        _log.info("dictionary.populate.finished", count=added)
        return added
