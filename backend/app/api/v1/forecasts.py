from fastapi import APIRouter, Depends

from app.api.caching import cache_historical
from app.api.deps import DecisionServiceDep
from app.api.params import DEFAULT_GATE_TIME, DayParam, GateParam, parse_gate
from app.schemas.forecasts import DecisionResponse, RunsResponse
from app.schemas.problem import ERROR_RESPONSES

router = APIRouter(
    prefix="/forecasts", tags=["forecasts"], dependencies=[Depends(cache_historical)]
)


@router.get(
    "/decision",
    response_model=DecisionResponse,
    summary="The forecast available at the gate for one delivery day, against the actuals",
    responses=ERROR_RESPONSES,
)
def decision(
    service: DecisionServiceDep, day: DayParam, gate: GateParam = DEFAULT_GATE_TIME
) -> DecisionResponse:
    return service.decision(day, parse_gate(gate))


@router.get(
    "/runs",
    response_model=RunsResponse,
    summary="Every forecast run published on the day before delivery, scored on the day",
    responses=ERROR_RESPONSES,
)
def runs(service: DecisionServiceDep, day: DayParam) -> RunsResponse:
    return service.runs(day)
