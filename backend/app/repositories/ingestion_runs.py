"""The ingestion_run audit table: what ran, when, and how it went."""

from datetime import UTC, date, datetime
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import IngestionRun

RunStatus = Literal["running", "succeeded", "failed"]


class IngestionRunRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def start(self, dataset: str, window_from: date, window_to: date) -> IngestionRun:
        run = IngestionRun(
            dataset=dataset, window_from=window_from, window_to=window_to, status="running"
        )
        self.session.add(run)
        self.session.flush()
        return run

    def finish(
        self,
        run: IngestionRun,
        *,
        status: RunStatus,
        rows_fetched: int = 0,
        rows_skipped: int = 0,
        rows_upserted: int = 0,
        error: str | None = None,
    ) -> None:
        run.status = status
        run.rows_fetched = rows_fetched
        run.rows_skipped = rows_skipped
        run.rows_upserted = rows_upserted
        run.error = error
        run.finished_at = datetime.now(UTC)
        self.session.add(run)

    def latest_succeeded(self, dataset: str) -> IngestionRun | None:
        stmt = (
            select(IngestionRun)
            .where(IngestionRun.dataset == dataset, IngestionRun.status == "succeeded")
            .order_by(IngestionRun.finished_at.desc())
            .limit(1)
        )
        return self.session.scalars(stmt).first()

    def last_success_at(self, dataset: str) -> datetime | None:
        """When an ingestion of `dataset` last finished successfully."""
        stmt = select(func.max(IngestionRun.finished_at)).where(
            IngestionRun.dataset == dataset, IngestionRun.status == "succeeded"
        )
        return self.session.scalar(stmt)
