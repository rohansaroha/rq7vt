"""App factory. `app` at the bottom is what uvicorn and Vercel load."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1 import router as v1_router
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.etag import ETagMiddleware
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, json_logs=settings.log_json)

    app = FastAPI(
        title="Wind Forecast Portal API",
        version=__version__,
        description=(
            "UK national wind generation: the forecast available at decision time and "
            "how accurate such forecasts were. Data: Elexon FUELHH and WINDFOR."
        ),
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url=None,
    )
    # The last middleware added runs first: request context -> CORS -> ETag -> routes.
    app.add_middleware(ETagMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "Server-Timing", "ETag"],
    )
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)
    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
