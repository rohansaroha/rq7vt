"""Version 1 of the API. Changes here are additive only; breaking ones go to /api/v2."""

from fastapi import APIRouter

from app.api.v1 import accuracy, forecasts, health, meta

router = APIRouter()
router.include_router(health.router)
router.include_router(meta.router)
router.include_router(forecasts.router)
router.include_router(accuracy.router)
