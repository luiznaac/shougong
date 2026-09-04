"""Structured logging — the `logger()` extension + `logback.xml` equivalent.

`configure_logging` is called once from the composition root; everything else
just calls `get_logger(__name__)`.
"""

from __future__ import annotations

import contextlib
import logging
import sys

import structlog
from structlog.typing import FilteringBoundLogger

__all__ = ["configure_logging", "get_logger"]


def configure_logging(level: str = "INFO", *, json: bool = True) -> None:
    # The console renderer prints event fields (e.g. a hanzi character) as-is;
    # on Windows, stdout otherwise defaults to the system codepage (cp1252),
    # which can't encode CJK and crashes the log call. JSON output already
    # escapes non-ASCII, so this only matters for the dev console renderer.
    if not json:
        with contextlib.suppress(AttributeError, ValueError):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]

    renderer: structlog.types.Processor = (
        structlog.processors.JSONRenderer() if json else structlog.dev.ConsoleRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelNamesMapping()[level.upper()],
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> FilteringBoundLogger:
    logger: FilteringBoundLogger = structlog.get_logger(name)
    return logger
