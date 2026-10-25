from fastapi import APIRouter, Depends

from app.api.caching import cache_briefly
from app.api.deps import MetaServiceDep
from app.schemas.meta import MetaResponse
from app.schemas.problem import ERROR_RESPONSES

router = APIRouter(tags=["system"], dependencies=[Depends(cache_briefly)])


@router.get(
    "/meta",
    response_model=MetaResponse,
    summary="What the app covers: period, auctions, horizons and data freshness",
    responses=ERROR_RESPONSES,
)
def meta(service: MetaServiceDep) -> MetaResponse:
    return service.meta()
