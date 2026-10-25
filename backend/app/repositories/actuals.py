"""Read and write metered generation from Elexon FUELHH (the app uses fuel type WIND)."""

from collections.abc import Sequence
from datetime import date, datetime
from typing import TypedDict

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import ActualGeneration
from app.domain.frames import actual_frame
from app.repositories.common import Coverage

UPSERT_BATCH_SIZE = 2_000
WIND = "WIND"


class ActualRow(TypedDict):
    fuel_type: str
    start_time: datetime
    settlement_date: date
    settlement_period: int
    generation_mw: int
    publish_time: datetime


class ActualsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert(self, rows: Sequence[ActualRow]) -> int:
        """Insert new half-hours and apply newer revisions; return rows inserted or changed.

        Running it again with the same data changes nothing and returns 0 (idempotent).
        The caller owns the transaction: this method never commits.
        """
        changed = 0
        for offset in range(0, len(rows), UPSERT_BATCH_SIZE):
            batch = [dict(row) for row in rows[offset : offset + UPSERT_BATCH_SIZE]]
            stmt = insert(ActualGeneration).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=[ActualGeneration.fuel_type, ActualGeneration.start_time],
                set_={
                    "settlement_date": stmt.excluded.settlement_date,
                    "settlement_period": stmt.excluded.settlement_period,
                    "generation_mw": stmt.excluded.generation_mw,
                    "publish_time": stmt.excluded.publish_time,
                    "ingested_at": func.now(),
                },
                # Only a newer revision of a half-hour may replace the one we hold.
                where=ActualGeneration.publish_time < stmt.excluded.publish_time,
            )
            # RETURNING lists only rows actually inserted or updated, so a re-run counts 0.
            changed += len(self.session.execute(stmt.returning(ActualGeneration.start_time)).all())
        return changed

    def frame(
        self, start_from: datetime, start_to: datetime, fuel_type: str = WIND
    ) -> pd.DataFrame:
        """Metered half-hours starting in [start_from, start_to), as an actuals frame."""
        stmt = (
            select(ActualGeneration.start_time, ActualGeneration.generation_mw)
            .where(
                ActualGeneration.fuel_type == fuel_type,
                ActualGeneration.start_time >= start_from,
                ActualGeneration.start_time < start_to,
            )
            .order_by(ActualGeneration.start_time)
        )
        return actual_frame(self.session.execute(stmt).all())

    def coverage(self, fuel_type: str = WIND) -> Coverage:
        stmt = select(
            func.count(),
            func.min(ActualGeneration.start_time),
            func.max(ActualGeneration.start_time),
            func.max(ActualGeneration.ingested_at),
        ).where(ActualGeneration.fuel_type == fuel_type)
        rows, first, last, ingested = self.session.execute(stmt).one()
        return Coverage(rows, first, last, ingested)
