"""The three tables. Times are stored as timestamptz in UTC; MW values as integers."""

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Identity,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ActualGeneration(Base):
    """One half-hour of metered generation for one fuel type (Elexon FUELHH)."""

    __tablename__ = "actual_generation"

    fuel_type: Mapped[str] = mapped_column(String(16), primary_key=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    settlement_date: Mapped[date] = mapped_column(Date)
    settlement_period: Mapped[int] = mapped_column(SmallInteger)
    generation_mw: Mapped[int] = mapped_column(Integer)
    # Elexon can revise a half-hour; the newest publish_time wins on upsert.
    publish_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class WindForecast(Base):
    """One hourly value from one forecast run (Elexon WINDFOR).

    The key (start_time, publish_time) means: the forecast for `start_time`, as published
    at `publish_time`. Its index also serves "latest run published before X" lookups.
    """

    __tablename__ = "wind_forecast"

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    publish_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, index=True
    )
    generation_mw: Mapped[int] = mapped_column(Integer)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class IngestionRun(Base):
    """Audit trail: one row per ingestion job, successful or not."""

    __tablename__ = "ingestion_run"
    __table_args__ = (
        CheckConstraint("status IN ('running', 'succeeded', 'failed')", name="status"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(), primary_key=True)
    dataset: Mapped[str] = mapped_column(String(16))
    window_from: Mapped[date] = mapped_column(Date)
    window_to: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16))
    rows_fetched: Mapped[int] = mapped_column(Integer, server_default="0")
    rows_skipped: Mapped[int] = mapped_column(Integer, server_default="0")
    rows_upserted: Mapped[int] = mapped_column(Integer, server_default="0")
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
