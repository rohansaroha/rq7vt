"""Every error leaves the API in one shape: RFC 9457 problem details.

    {"type": "/problems/invalid-window", "title": "Invalid date window",
     "status": 422, "detail": "'from' must be on or before 'to'"}

The frontend therefore needs a single error component, whatever went wrong.
"""

from http import HTTPStatus
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, ProgrammingError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger(__name__)

PROBLEM_JSON = "application/problem+json"
UNDEFINED_TABLE = "42P01"  # Postgres SQLSTATE: the table does not exist


class AppError(Exception):
    """Base class for errors the API reports to its clients."""

    status_code: int = 400
    problem_type: str = "about:blank"
    title: str = "Bad request"

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class InvalidRequestError(AppError):
    status_code = 422
    problem_type = "/problems/invalid-request"
    title = "Invalid request"


class InvalidWindowError(InvalidRequestError):
    problem_type = "/problems/invalid-window"
    title = "Invalid date window"


class OutOfRangeError(InvalidRequestError):
    problem_type = "/problems/out-of-range"
    title = "Out of range"


class NotFoundError(AppError):
    status_code = 404
    problem_type = "/problems/not-found"
    title = "Not found"


class DatabaseNotConfiguredError(AppError):
    status_code = 503
    problem_type = "/problems/database-not-configured"
    title = "Database not configured"

    def __init__(self) -> None:
        super().__init__(
            "DATABASE_URL is not set. On Vercel, connect the Neon database to the project and "
            "redeploy; locally, run `make setup`."
        )


def problem(
    status: int,
    title: str,
    detail: str | None = None,
    problem_type: str = "about:blank",
    **extra: Any,
) -> JSONResponse:
    body: dict[str, Any] = {"type": problem_type, "title": title, "status": status}
    if detail:
        body["detail"] = detail
    body.update(extra)
    return JSONResponse(status_code=status, content=jsonable_encoder(body), media_type=PROBLEM_JSON)


def _status_phrase(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return problem(exc.status_code, exc.title, exc.detail, exc.problem_type)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return problem(
            422,
            "Invalid request",
            "One or more parameters are invalid.",
            "/problems/invalid-request",
            errors=exc.errors(),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        title = _status_phrase(exc.status_code)
        detail = exc.detail if isinstance(exc.detail, str) and exc.detail != title else None
        return problem(exc.status_code, title, detail)

    @app.exception_handler(OperationalError)
    async def handle_database_down(_: Request, exc: OperationalError) -> JSONResponse:
        # Connection refused, wrong password, unknown database: the database is unusable.
        log.error("database_unavailable", error=str(exc.orig or exc))
        return problem(
            503,
            "Database unavailable",
            "The API cannot reach its database. Running locally? Start it with `make db`, "
            "and check DATABASE_URL in backend/.env.",
            "/problems/database-unavailable",
        )

    @app.exception_handler(ProgrammingError)
    async def handle_database_error(request: Request, exc: ProgrammingError) -> JSONResponse:
        if getattr(exc.orig, "sqlstate", None) == UNDEFINED_TABLE:
            log.error("database_not_migrated", error=str(exc.orig))
            return problem(
                503,
                "Database not set up",
                "The database has no tables yet. Run `make migrate`, then `make ingest`.",
                "/problems/database-not-migrated",
            )
        return await handle_unexpected(request, exc)

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", error_type=type(exc).__name__)
        return problem(
            500,
            "Internal Server Error",
            "Something went wrong. Quote the X-Request-ID header when reporting it.",
        )
