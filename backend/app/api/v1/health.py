from typing import Literal

import structlog
from fastapi import APIRouter, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.api.deps import OptionalSessionDep
from app.schemas.health import HealthResponse

log = structlog.get_logger(__name__)
router = APIRouter(tags=["system"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Is the API up, and can it reach the database?",
    responses={503: {"model": HealthResponse, "description": "Database unavailable"}},
)
def health(session: OptionalSessionDep, response: Response) -> HealthResponse:
    database: Literal["ok", "unavailable"] = "ok"
    if session is None:
        log.warning("health_database_not_configured")
        database = "unavailable"
    else:
        try:
            session.execute(text("SELECT 1"))
        except SQLAlchemyError:
            log.warning("health_database_unavailable")
            database = "unavailable"
    response.headers["Cache-Control"] = "no-store"
    if database != "ok":
        response.status_code = 503
    return HealthResponse(
        status="ok" if database == "ok" else "degraded",
        database=database,
        version=__version__,
    )
