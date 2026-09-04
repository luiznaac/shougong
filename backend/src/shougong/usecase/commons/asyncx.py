"""Async helpers — the `mapAsync` / `awaitAll` equivalents."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Iterable

_background_tasks: set[asyncio.Task[object]] = set()


async def map_async[T, R](items: Iterable[T], fn: Callable[[T], Awaitable[R]]) -> list[R]:
    """Apply an async function to every item concurrently, preserving order."""
    results: list[R] = await asyncio.gather(*(fn(item) for item in items))
    return results


def fire_and_forget[T](coro: Awaitable[T]) -> asyncio.Task[T]:
    """Schedule `coro` to run without waiting for it.

    A module-level reference is kept until the task finishes so it can't be
    garbage-collected mid-flight (asyncio only holds a weak reference to a
    task once nothing else does). The returned `Task` is a convenience for
    callers — e.g. tests — that want to await it directly; production
    call sites are expected to ignore it.
    """
    task = asyncio.ensure_future(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task
