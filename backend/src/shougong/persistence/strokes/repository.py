"""`StrokeRepository` — implements `IStrokeRepository` against MySQL.

`save` uses `session.merge()` (upsert) rather than a plain `INSERT`: two
concurrent requests can both miss the cache for the same never-before-seen
character, and both would otherwise try to insert the same primary key.
"""

from __future__ import annotations

from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.strokes.entity import CharacterStrokesEntity
from shougong.usecase.strokes.gateway import IStrokeRepository
from shougong.usecase.strokes.model import CharacterStrokes, StrokeLookupResult


def to_domain(row: CharacterStrokesEntity) -> StrokeLookupResult:
    if not row.has_data:
        return StrokeLookupResult(character=row.character, strokes=None)
    return StrokeLookupResult(
        character=row.character,
        strokes=CharacterStrokes(
            character=row.character,
            strokes=tuple(row.strokes or []),
            medians=tuple(tuple((pt[0], pt[1]) for pt in stroke) for stroke in (row.medians or [])),
        ),
    )


class StrokeRepository(IStrokeRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def find(self, character: str) -> StrokeLookupResult | None:
        async def _run() -> StrokeLookupResult | None:
            session = current_session()
            row = await session.get(CharacterStrokesEntity, character)
            return to_domain(row) if row is not None else None

        return await self._tx.execute(_run)

    async def save(self, character: str, strokes: CharacterStrokes | None) -> None:
        async def _run() -> None:
            session = current_session()
            entity = CharacterStrokesEntity(
                character=character,
                has_data=strokes is not None,
                strokes=list(strokes.strokes) if strokes else None,
                medians=[[list(pt) for pt in stroke] for stroke in strokes.medians] if strokes else None,
            )
            await session.merge(entity)

        return await self._tx.execute(_run)
