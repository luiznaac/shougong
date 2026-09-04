from __future__ import annotations

import asyncio

import pytest

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.strokes.model import StrokeLookupResult
from shougong.usecase.strokes.service import StrokeService
from tests.fixtures import FakeHanziStrokeSource, FakeStrokeRepository, make_character_strokes


async def test_get_returns_cached_strokes_without_calling_source() -> None:
    repository = FakeStrokeRepository()
    strokes = make_character_strokes(character="学")
    repository.rows["学"] = StrokeLookupResult(character="学", strokes=strokes)
    source = FakeHanziStrokeSource()
    service = StrokeService(repository, source)

    result = await service.get("学")

    assert result == strokes
    assert source.fetch_calls == 0


async def test_get_fetches_and_caches_on_miss() -> None:
    repository = FakeStrokeRepository()
    strokes = make_character_strokes(character="水")
    source = FakeHanziStrokeSource({"水": strokes})
    service = StrokeService(repository, source)

    result = await service.get("水")

    assert result == strokes
    assert source.fetch_calls == 1
    assert repository.rows["水"].strokes == strokes


async def test_get_raises_not_found_when_source_has_no_data() -> None:
    repository = FakeStrokeRepository()
    source = FakeHanziStrokeSource({"。": None})
    service = StrokeService(repository, source)

    with pytest.raises(ResourceNotFoundError):
        await service.get("。")

    assert repository.rows["。"].strokes is None


async def test_get_raises_not_found_immediately_when_negatively_cached() -> None:
    repository = FakeStrokeRepository()
    repository.rows["。"] = StrokeLookupResult(character="。", strokes=None)
    source = FakeHanziStrokeSource()
    service = StrokeService(repository, source)

    with pytest.raises(ResourceNotFoundError):
        await service.get("。")

    assert source.fetch_calls == 0  # no synchronous refetch — the caller isn't kept waiting


async def test_get_schedules_a_background_retry_when_negatively_cached() -> None:
    # A character stuck with has_data=0 from a past failed/legacy attempt
    # should still self-heal: `get` schedules a retry in the background even
    # though it 404s immediately for the current caller.
    repository = FakeStrokeRepository()
    strokes = make_character_strokes(character="学")
    repository.rows["学"] = StrokeLookupResult(character="学", strokes=None)
    source = FakeHanziStrokeSource({"学": strokes})
    service = StrokeService(repository, source)

    with pytest.raises(ResourceNotFoundError):
        await service.get("学")
    await asyncio.sleep(0)  # let the background retry run

    assert source.fetch_calls == 1
    assert repository.rows["学"].strokes == strokes  # cache healed for the next view


async def test_warm_skips_a_positively_cached_character() -> None:
    repository = FakeStrokeRepository()
    strokes = make_character_strokes(character="学")
    repository.rows["学"] = StrokeLookupResult(character="学", strokes=strokes)
    source = FakeHanziStrokeSource()
    service = StrokeService(repository, source)

    await service.warm("学")

    assert source.fetch_calls == 0


async def test_warm_retries_a_negatively_cached_character() -> None:
    repository = FakeStrokeRepository()
    strokes = make_character_strokes(character="学")
    repository.rows["学"] = StrokeLookupResult(character="学", strokes=None)
    source = FakeHanziStrokeSource({"学": strokes})
    service = StrokeService(repository, source)

    await service.warm("学")

    assert repository.rows["学"].strokes == strokes
