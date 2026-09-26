"""Teammate-finding endpoints - per-event board + global feed."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from app.models.event import Event
from app.models.teammate import TeammateInterest
from app.schemas.event import EventType
from app.schemas.teammate import TeammateCreate, TeammateOut
from app.utils.auth import CurrentUser, require_user

router = APIRouter(prefix="/teammates", tags=["teammates"])


def _to_out(t: TeammateInterest) -> TeammateOut:
    return TeammateOut(
        id=str(t.id),
        user_id=t.user_id,
        user_name=t.user_name,
        event_id=t.event_id,
        event_title=t.event_title,
        event_type=t.event_type,
        event_date=t.event_date.date(),
        event_city=t.event_city,
        event_online=t.event_online,
        pitch=t.pitch,
        contact=t.contact,
    )


@router.post("", response_model=TeammateOut, status_code=201)
async def mark_looking(payload: TeammateCreate, user: CurrentUser = Depends(require_user)):
    """Signal that the signed-in user is looking for teammates on a specific event."""
    try:
        oid = PydanticObjectId(payload.event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event id")

    event = await Event.get(oid)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    # Prefer the display name they set at signup; fall back to email prefix.
    display_name = user.name or (user.email.split("@")[0] if user.email else "someone")

    doc = TeammateInterest(
        user_id=user.id,
        user_name=display_name,
        user_email=user.email,
        event_id=str(event.id),
        event_title=event.title,
        event_type=event.type,
        event_date=event.date,
        event_city=event.city,
        event_online=event.online,
        pitch=payload.pitch.strip(),
        contact=payload.contact.strip(),
        created_at=datetime.now(timezone.utc),
    )
    try:
        await doc.insert()
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="You're already listed for this event.")
    return _to_out(doc)


@router.get("", response_model=list[TeammateOut])
async def list_teammates(
    type: Optional[EventType] = Query(None, description="Filter by event type"),
    city: Optional[str] = Query(None, max_length=80, description="Filter by city"),
    online: Optional[bool] = Query(None, description="Filter online / in-person"),
):
    """Global feed - every user actively looking, newest first. Optional filters."""
    query: dict = {}
    if type:
        query["event_type"] = type
    if online is not None:
        query["event_online"] = online

    interests = await TeammateInterest.find(query).sort("-created_at").to_list()

    if city:
        c = city.lower()
        interests = [t for t in interests if (t.event_city or "").lower() == c]

    return [_to_out(t) for t in interests]


@router.get("/event/{event_id}", response_model=list[TeammateOut])
async def list_for_event(event_id: str):
    """Everyone looking for teammates on a specific event."""
    try:
        PydanticObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event id")
    interests = await TeammateInterest.find(TeammateInterest.event_id == event_id).sort("-created_at").to_list()
    return [_to_out(t) for t in interests]


@router.get("/mine", response_model=list[TeammateOut])
async def list_mine(user: CurrentUser = Depends(require_user)):
    """Every event the signed-in user has flagged themselves on."""
    interests = await TeammateInterest.find(TeammateInterest.user_id == user.id).sort("-created_at").to_list()
    return [_to_out(t) for t in interests]


@router.delete("/{interest_id}", status_code=204)
async def unmark(interest_id: str, user: CurrentUser = Depends(require_user)):
    """Withdraw yourself from an event's teammate board."""
    try:
        oid = PydanticObjectId(interest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    t = await TeammateInterest.get(oid)
    if t is None:
        raise HTTPException(status_code=404, detail="Not found")
    if t.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only remove your own posts.")
    await t.delete()
    return None
