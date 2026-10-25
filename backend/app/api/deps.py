"""Dependencies FastAPI injects into route handlers.

The chain is session -> repositories -> services. Tests replace the repository
providers (`app.dependency_overrides[get_forecasts] = ...`) with in-memory fakes, so
every layer above them runs for real without a database.
"""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_sessionmaker
from app.repositories.actuals import ActualsRepository
from app.repositories.forecasts import ForecastRepository
from app.repositories.ingestion_runs import IngestionRunRepository
from app.services.accuracy import AccuracyService
from app.services.decision import DecisionService
from app.services.meta import MetaService
from app.services.readers import ActualsReader, ForecastReader, IngestionLog


def get_session() -> Iterator[Session]:
    """One database session per request, closed after the response is sent."""
    with get_sessionmaker()() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


def get_optional_session() -> Iterator[Session | None]:
    """A session, or None while no database is configured (the health check needs this)."""
    if get_settings().database_url is None:
        yield None
        return
    with get_sessionmaker()() as session:
        yield session


OptionalSessionDep = Annotated[Session | None, Depends(get_optional_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_forecasts(session: SessionDep) -> ForecastReader:
    return ForecastRepository(session)


def get_actuals(session: SessionDep) -> ActualsReader:
    return ActualsRepository(session)


def get_ingestion_log(session: SessionDep) -> IngestionLog:
    return IngestionRunRepository(session)


ForecastsDep = Annotated[ForecastReader, Depends(get_forecasts)]
ActualsDep = Annotated[ActualsReader, Depends(get_actuals)]
IngestionLogDep = Annotated[IngestionLog, Depends(get_ingestion_log)]


def get_decision_service(
    forecasts: ForecastsDep, actuals: ActualsDep, settings: SettingsDep
) -> DecisionService:
    return DecisionService(forecasts, actuals, settings)


def get_accuracy_service(
    forecasts: ForecastsDep, actuals: ActualsDep, settings: SettingsDep
) -> AccuracyService:
    return AccuracyService(forecasts, actuals, settings)


def get_meta_service(
    forecasts: ForecastsDep,
    actuals: ActualsDep,
    ingestion: IngestionLogDep,
    settings: SettingsDep,
) -> MetaService:
    return MetaService(forecasts, actuals, ingestion, settings)


DecisionServiceDep = Annotated[DecisionService, Depends(get_decision_service)]
AccuracyServiceDep = Annotated[AccuracyService, Depends(get_accuracy_service)]
MetaServiceDep = Annotated[MetaService, Depends(get_meta_service)]
