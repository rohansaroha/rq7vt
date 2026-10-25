"""Conditional GETs: an ETag on cacheable JSON responses, and 304 when it still matches.

The tag is a hash of the body, so it changes exactly when the data does. A client that
already holds the response sends it back in If-None-Match and gets an empty 304 instead
of the payload. Written as plain ASGI middleware so it can buffer the body without
Starlette's BaseHTTPMiddleware machinery.
"""

import hashlib

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Headers a 304 must not carry: it has no body.
_BODY_HEADERS = {"content-length", "content-type", "content-encoding"}


def etag_for(body: bytes) -> str:
    return f'W/"{hashlib.sha256(body).hexdigest()[:32]}"'


def _matches(if_none_match: str, etag: str) -> bool:
    """Weak comparison, as RFC 9110 requires for If-None-Match."""
    wanted = etag.removeprefix("W/")
    candidates = (tag.strip().removeprefix("W/") for tag in if_none_match.split(","))
    return any(tag in (wanted, "*") for tag in candidates)


class ETagMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in ("GET", "HEAD"):
            await self.app(scope, receive, send)
            return

        if_none_match = Headers(scope=scope).get("if-none-match")
        start: Message | None = None
        passthrough = False
        chunks: list[bytes] = []

        async def send_with_etag(message: Message) -> None:
            nonlocal start, passthrough
            if message["type"] == "http.response.start":
                headers = Headers(raw=message["headers"])
                passthrough = not (
                    message["status"] == 200
                    and headers.get("content-type", "").startswith("application/json")
                    and "etag" not in headers
                    and "no-store" not in headers.get("cache-control", "")
                )
                if passthrough:
                    await send(message)
                else:
                    start = message  # hold it until the body is complete
                return
            if passthrough or start is None or message["type"] != "http.response.body":
                await send(message)
                return

            chunks.append(message.get("body", b""))
            if message.get("more_body", False):
                return
            body = b"".join(chunks)
            etag = etag_for(body)
            headers = MutableHeaders(scope=start)
            headers["ETag"] = etag
            if if_none_match and _matches(if_none_match, etag):
                start["status"] = 304
                start["headers"] = [
                    (k, v) for k, v in start["headers"] if k.decode().lower() not in _BODY_HEADERS
                ]
                body = b""
            await send(start)
            await send({"type": "http.response.body", "body": body})

        await self.app(scope, receive, send_with_etag)
