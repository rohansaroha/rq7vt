"""Structured logging with structlog.

Every log line is a JSON object in production (LOG_JSON=true) and a readable line
locally. A request ID bound in the middleware is added to every line automatically.
"""

import logging

import structlog


def configure_logging(level: str = "INFO", *, json_logs: bool = False) -> None:
    renderer: structlog.typing.Processor = (
        structlog.processors.JSONRenderer() if json_logs else structlog.dev.ConsoleRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelNamesMapping()[level.upper()]
        ),
        cache_logger_on_first_use=True,
    )
