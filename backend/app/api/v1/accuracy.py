from fastapi import APIRouter, Depends

from app.api.caching import cache_historical
from app.api.deps import AccuracyServiceDep
from app.api.params import (
    DEFAULT_GATE_TIME,
    ForecastParam,
    GateParam,
    HorizonParam,
    ModeParam,
    parse_gate,
)
from app.domain.selection import AtGate, AtHorizon, Selection
from app.schemas.accuracy import AccuracySummary, DaysResponse, LeadTimeResponse
from app.schemas.problem import ERROR_RESPONSES
from app.services.meta import DEFAULT_HORIZON_H

router = APIRouter(prefix="/accuracy", tags=["accuracy"], dependencies=[Depends(cache_historical)])


@router.get(
    "/summary",
    response_model=AccuracySummary,
    summary="Accuracy over the analysis period, the error distribution and buffer sizes",
    responses=ERROR_RESPONSES,
)
def summary(
    service: AccuracyServiceDep,
    mode: ModeParam = "gate",
    gate: GateParam = DEFAULT_GATE_TIME,
    horizon_h: HorizonParam = DEFAULT_HORIZON_H,
    forecast: ForecastParam = "published",
) -> AccuracySummary:
    selection: Selection = AtGate(parse_gate(gate)) if mode == "gate" else AtHorizon(horizon_h)
    return service.summary(selection, forecast)


@router.get(
    "/days",
    response_model=DaysResponse,
    summary="Each delivery day at the gate: energy, typical miss, worst shortfall, correction",
    responses=ERROR_RESPONSES,
)
def days(service: AccuracyServiceDep, gate: GateParam = DEFAULT_GATE_TIME) -> DaysResponse:
    return service.days(parse_gate(gate))


@router.get(
    "/lead-time",
    response_model=LeadTimeResponse,
    summary="How the error grows with lead time, overall and by hour of day",
    responses=ERROR_RESPONSES,
)
def lead_time(service: AccuracyServiceDep) -> LeadTimeResponse:
    return service.lead_time()
