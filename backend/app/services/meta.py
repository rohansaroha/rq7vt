"""What the app covers and how fresh its data is: the frontend builds its controls from it."""

from app import __version__
from app.core.config import Settings
from app.domain.gates import DEFAULT_GATE, GATES
from app.domain.lead_time import HORIZONS_H
from app.repositories.common import Coverage
from app.schemas.meta import DatasetStatus, GatePreset, HorizonRange, MetaResponse
from app.services.common import analysis_period
from app.services.readers import ActualsReader, ForecastReader, IngestionLog

DEFAULT_HORIZON_H = 24


def _status(name: str, source: str, coverage: Coverage, ingestion: IngestionLog) -> DatasetStatus:
    return DatasetStatus.model_validate(
        {
            "name": name,
            "source": source,
            "rows": coverage.rows,
            "runs": coverage.runs,
            "first_start_time": coverage.first_start_time,
            "last_start_time": coverage.last_start_time,
            "last_ingested_at": coverage.last_ingested_at,
            "last_success_at": ingestion.last_success_at(name),
        }
    )


class MetaService:
    def __init__(
        self,
        forecasts: ForecastReader,
        actuals: ActualsReader,
        ingestion: IngestionLog,
        settings: Settings,
    ) -> None:
        self._forecasts = forecasts
        self._actuals = actuals
        self._ingestion = ingestion
        self._settings = settings

    def meta(self) -> MetaResponse:
        datasets = [
            _status(
                "actuals",
                "Elexon FUELHH, fuel type WIND",
                self._actuals.coverage(),
                self._ingestion,
            ),
            _status("forecasts", "Elexon WINDFOR", self._forecasts.coverage(), self._ingestion),
        ]
        successes = [d.last_success_at for d in datasets if d.last_success_at is not None]
        return MetaResponse(
            version=__version__,
            period=analysis_period(self._settings),
            gates=[
                GatePreset(
                    id=g.id,
                    time=g.closes.strftime("%H:%M"),
                    label=g.label,
                    description=g.description,
                )
                for g in GATES
            ],
            default_gate=DEFAULT_GATE.closes.strftime("%H:%M"),
            horizon=HorizonRange(
                min_h=HORIZONS_H[0], max_h=HORIZONS_H[-1], default_h=DEFAULT_HORIZON_H
            ),
            datasets=datasets,
            data_as_of=max(successes) if successes else None,
        )
