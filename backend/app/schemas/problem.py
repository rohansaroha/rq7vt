from typing import Any

from pydantic import BaseModel, Field


class Problem(BaseModel):
    """RFC 9457 problem details: the body of every error response."""

    type: str = Field(description="A URI reference identifying the kind of problem")
    title: str
    status: int
    detail: str | None = None
    errors: list[dict[str, Any]] | None = Field(
        default=None, description="Per-parameter validation errors, when the request was invalid"
    )


ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": Problem, "description": "Invalid parameters"},
    500: {"model": Problem, "description": "Unexpected error"},
}
