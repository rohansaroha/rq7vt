"""Cache-Control policies, applied per router as a dependency.

The data describes a closed period of history, so responses can be cached hard: briefly
by browsers (max-age), for a day by the CDN (s-maxage), and served stale while the CDN
refetches in the background. Error responses are built by the exception handlers, not
by the route, so they never carry these headers and failures are not cached.
"""

from fastapi import Response

from app.api.deps import SettingsDep


def cache_historical(response: Response, settings: SettingsDep) -> None:
    response.headers["Cache-Control"] = (
        f"public, max-age={settings.cache_max_age_s}, s-maxage={settings.cache_s_maxage_s}, "
        f"stale-while-revalidate={settings.cache_s_maxage_s}"
    )


def cache_briefly(response: Response) -> None:
    """For responses that change when ingestion runs (data freshness)."""
    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=60"
