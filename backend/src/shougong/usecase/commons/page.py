"""One page of a filtered, ordered list read.

The page carries the exact total of the filtered set, so a client can page through
without probing for a short page, and the window it was cut from. The server never
implements a "load more" mode; presentation is the client's.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Page[T]:
    items: tuple[T, ...]
    total: int
    limit: int
    offset: int
