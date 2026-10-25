"""Read and write wind forecast runs from Elexon WINDFOR."""

from collections.abc import Sequence
from datetime import datetime
from typing import TypedDict

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import WindForecast
from app.domain.frames import forecast_frame
from app.repositories.common import Coverage

UPSERT_BATCH_SIZE = 2_000


class ForecastRow(TypedDict):
    start_time: datetime
    publish_time: datetime
    generation_mw: int


class ForecastRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert(self, rows: Sequence[ForecastRow]) -> int:
        """Insert new forecast values; return rows inserted or changed.

        A value is only rewritten if Elexon changed it, so a re-run returns 0.
        The caller owns the transaction: this method never commits.
        """
        changed = 0
        for offset in range(0, len(rows), UPSERT_BATCH_SIZE):
            batch = [dict(row) for row in rows[offset : offset + UPSERT_BATCH_SIZE]]
            stmt = insert(WindForecast).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=[WindForecast.start_time, WindForecast.publish_time],
                set_={"generation_mw": stmt.excluded.generation_mw, "ingested_at": func.now()},
                where=WindForecast.generation_mw.is_distinct_from(stmt.excluded.generation_mw),
            )
            # RETURNING lists only rows actually inserted or updated, so a re-run counts 0.
            changed += len(self.session.execute(stmt.returning(WindForecast.start_time)).all())
        return changed

    def frame(self, start_from: datetime, start_to: datetime) -> pd.DataFrame:
        """Every run's value for each hour starting in [start_from, start_to).

        One row per (start_time, publish_time), in the domain's forecast frame shape.
        The primary key (start_time, publish_time) serves this range scan.
        """
        stmt = (
            select(WindForecast.start_time, WindForecast.publish_time, WindForecast.generation_mw)
            .where(WindForecast.start_time >= start_from, WindForecast.start_time < start_to)
            .order_by(WindForecast.start_time, WindForecast.publish_time)
        )
        return forecast_frame(self.session.execute(stmt).all())

    def coverage(self) -> Coverage:
        stmt = select(
            func.count(),
            func.min(WindForecast.start_time),
            func.max(WindForecast.start_time),
            func.max(WindForecast.ingested_at),
            func.count(func.distinct(WindForecast.publish_time)),
        )
        rows, first, last, ingested, runs = self.session.execute(stmt).one()
        return Coverage(rows, first, last, ingested, runs=runs)
