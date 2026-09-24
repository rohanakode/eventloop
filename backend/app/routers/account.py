"""Account management — currently just self-serve deletion.

Deleting an account removes the user's events from MongoDB AND removes the
user record from Supabase Auth. The Supabase delete uses the admin API,
which needs the service_role key; that key stays server-side.
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.models.event import Event
from app.models.teammate import TeammateInterest
from app.utils.auth import CurrentUser, require_user

router = APIRouter(prefix="/account", tags=["account"])


@router.delete("/me", status_code=204)
async def delete_account(user: CurrentUser = Depends(require_user)):
    """Delete every event the user has posted, then delete their Supabase
    auth record. This can't be undone."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account deletion is not configured on the server.",
        )

    # 1) Wipe everything this user owns in our DB — events + teammate posts.
    await Event.find(Event.user_id == user.id).delete()
    await TeammateInterest.find(TeammateInterest.user_id == user.id).delete()

    # 2) Hard-delete the Supabase auth user via the admin API.
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user.id}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.delete(url, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Supabase: {exc}")

    if resp.status_code >= 400:
        # Roll-forward: events already gone, but user record still there.
        # Surface the error so the client can retry.
        raise HTTPException(
            status_code=502,
            detail=f"Supabase refused to delete the account ({resp.status_code}).",
        )
    return None
