"""Per-user rate limiting for authenticated write endpoints.

Uses slowapi (a FastAPI-friendly wrapper around limits). The key comes from
the verified JWT so the limit is scoped to the actual user, not the IP -
otherwise co-workers behind one NAT would starve each other.

Anonymous requests (no Authorization header) fall back to the client IP -
they should be rare on protected routes but this keeps the limiter safe.
"""
from __future__ import annotations

from typing import Optional

import jwt
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings


def _user_key(request: Request) -> str:
    """Prefer the Supabase user id (decoded without verifying - we're just
    keying a bucket, not authenticating). Fall back to the client IP.
    """
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        try:
            claims: dict = jwt.decode(token, options={"verify_signature": False})
            sub: Optional[str] = claims.get("sub")
            if sub:
                return f"user:{sub}"
        except Exception:
            pass
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_user_key, default_limits=[])
