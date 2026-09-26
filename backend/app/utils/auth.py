"""Supabase JWT verification for FastAPI.

Supabase signs tokens with either:
  1. The legacy HS256 secret (older projects), or
  2. Asymmetric keys - ES256 / RS256 - published via a JWKS endpoint
     at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.

We support both:
  - Read the token's `alg` header to decide which path to take.
  - For HS256, verify against `SUPABASE_JWT_SECRET`.
  - For anything else, fetch the JWKS (cached by PyJWKClient) and verify with
    the matching public key.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.config import settings


@dataclass
class CurrentUser:
    id: str        # Supabase user id (uuid, from `sub`)
    email: str     # user's email (from `email` claim)
    name: str      # display name from `user_metadata.name` (empty if not set)


def _name_from(claims: dict) -> str:
    md = claims.get("user_metadata") or {}
    return str(md.get("name") or md.get("full_name") or "").strip()


_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.supabase_url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth is not configured on the server (SUPABASE_URL missing).",
            )
        jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def _decode(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token.")

    alg = header.get("alg", "").upper()

    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Auth is not configured on the server (SUPABASE_JWT_SECRET missing).",
                )
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        # Asymmetric - fetch the right public key by kid from the JWKS.
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=[alg],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired - sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token.")


def _extract(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def require_user(authorization: Optional[str] = Header(None)) -> CurrentUser:
    """FastAPI dependency: 401 unless a valid Supabase JWT is present."""
    token = _extract(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    claims = _decode(token)
    return CurrentUser(id=claims["sub"], email=claims.get("email", ""), name=_name_from(claims))


def optional_user(authorization: Optional[str] = Header(None)) -> Optional[CurrentUser]:
    """FastAPI dependency: returns the user if signed in, None otherwise.
    Never raises for missing/malformed headers - but still rejects a bad token."""
    token = _extract(authorization)
    if not token:
        return None
    claims = _decode(token)
    return CurrentUser(id=claims["sub"], email=claims.get("email", ""), name=_name_from(claims))
