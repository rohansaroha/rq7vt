"""Create actual_generation, wind_forecast and ingestion_run.

Revision ID: 0001
Revises:
Create Date: 2026-10-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "actual_generation",
        sa.Column("fuel_type", sa.String(16), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("settlement_date", sa.Date(), nullable=False),
        sa.Column("settlement_period", sa.SmallInteger(), nullable=False),
        sa.Column("generation_mw", sa.Integer(), nullable=False),
        sa.Column("publish_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("fuel_type", "start_time", name=op.f("pk_actual_generation")),
    )
    op.create_table(
        "wind_forecast",
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("publish_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("generation_mw", sa.Integer(), nullable=False),
        sa.Column(
            "ingested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("start_time", "publish_time", name=op.f("pk_wind_forecast")),
    )
    op.create_index(op.f("ix_wind_forecast_publish_time"), "wind_forecast", ["publish_time"])
    op.create_table(
        "ingestion_run",
        sa.Column("id", sa.Integer(), sa.Identity(), nullable=False),
        sa.Column("dataset", sa.String(16), nullable=False),
        sa.Column("window_from", sa.Date(), nullable=False),
        sa.Column("window_to", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("rows_fetched", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rows_skipped", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rows_upserted", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('running', 'succeeded', 'failed')", name=op.f("ck_ingestion_run_status")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ingestion_run")),
    )


def downgrade() -> None:
    op.drop_table("ingestion_run")
    op.drop_index(op.f("ix_wind_forecast_publish_time"), table_name="wind_forecast")
    op.drop_table("wind_forecast")
    op.drop_table("actual_generation")
