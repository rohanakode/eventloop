"""Events endpoints - read from MongoDB (Atlas)."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pymongo.errors import DuplicateKeyError

from app.models.event import Event
from app.schemas.event import EventOut, EventType, UserEventCreate, UserEventUpdate
from app.services.embeddings import embed_texts
from app.services.search import semantic_search
from app.utils.auth import CurrentUser, require_user
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/events", tags=["events"])


def _to_out(e: Event) -> EventOut:
    return EventOut(
        id=str(e.id),
        title=e.title,
        description=e.description,
        type=e.type,
        date=e.date.date(),
        end_date=e.end_date.date() if e.end_date else None,
        registration_deadline=(
            e.registration_deadline.date() if e.registration_deadline else None
        ),
        city=e.city,
        online=e.online,
        source=e.source,
        source_url=e.source_url,
        tags=e.tags,
        user_id=e.user_id if e.source == "native" else None,
        user_name=e.user_name if e.source == "native" else None,
    )


@router.post("", response_model=EventOut, status_code=201)
@limiter.limit("10/day")
async def create_event(
    request: Request,
    payload: UserEventCreate,
    user: CurrentUser = Depends(require_user),
):
    """Publish a user-posted event. Requires sign-in; embeds inline so it
    surfaces in Discover and the resume-matching feed immediately."""
    base = payload.to_base()
    dedup_key = (
        base.source_url.rstrip("/").lower()
        if base.source_url
        else f"native:{user.id}:{base.title.strip().lower()}:{base.date.isoformat()}"
    )

    # Pre-check gives a clearer message; the DB unique index is still the
    # source of truth in case of a race.
    existing = await Event.find_one(Event.dedup_key == dedup_key)
    if existing is not None:
        if existing.user_id == user.id:
            raise HTTPException(status_code=409, detail="You already posted this event.")
        raise HTTPException(status_code=409, detail="This event is already on EventLoop (posted by someone else).")

    embed_text = f"{base.title}. Category: {base.type}. {base.description} Topics: {', '.join(base.tags)}"
    try:
        vector = embed_texts([embed_text])[0]
    except Exception:
        raise HTTPException(status_code=502, detail="Could not embed the event right now - try again.")

    doc = Event.from_base(base, dedup_key)
    doc.embedding = vector
    doc.user_id = user.id
    doc.user_email = user.email
    doc.user_name = user.name or (user.email.split("@")[0] if user.email else "")
    doc.updated_at = datetime.now(timezone.utc)
    try:
        await doc.insert()
    except DuplicateKeyError:
        # Someone (maybe another tab) beat us between the pre-check and insert.
        raise HTTPException(status_code=409, detail="This event is already on EventLoop.")
    return _to_out(doc)


@router.get("/mine", response_model=list[EventOut])
async def my_events(user: CurrentUser = Depends(require_user)):
    """Events posted by the current user, most recent first."""
    events = await Event.find(Event.user_id == user.id).sort("-created_at").to_list()
    return [_to_out(e) for e in events]


@router.patch("/{event_id}", response_model=EventOut)
async def update_event(
    event_id: str,
    payload: UserEventUpdate,
    user: CurrentUser = Depends(require_user),
):
    """Edit an event you posted. Only fields you send are changed; the
    embedding is recomputed only if title, description or tags change."""
    from beanie import PydanticObjectId
    from datetime import date as _date

    try:
        oid = PydanticObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event id")

    event = await Event.get(oid)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own events.")

    changes = payload.changed()
    if not changes:
        return _to_out(event)

    # Cross-field date validation against the merged final state.
    from datetime import timedelta as _td
    new_date = changes.get("date", event.date.date() if event.date else None)
    new_end = changes.get("end_date", event.end_date.date() if event.end_date else None)
    new_reg = changes.get("registration_deadline", event.registration_deadline.date() if event.registration_deadline else None)
    today = _date.today()
    cutoff = today + _td(days=365 * 3)
    if new_date:
        if new_date < today:
            raise HTTPException(status_code=422, detail="Event date cannot be in the past.")
        if new_date > cutoff:
            raise HTTPException(status_code=422, detail="Event date is unrealistically far away (max 3 years ahead).")
    if new_end:
        if new_date and new_end < new_date:
            raise HTTPException(status_code=422, detail="End date must be on or after the start date.")
        if new_end > cutoff:
            raise HTTPException(status_code=422, detail="End date is unrealistically far away (max 3 years ahead).")
    if new_reg:
        if new_date and new_reg > new_date:
            raise HTTPException(status_code=422, detail="Registration deadline must be on or before the event date.")
        if new_reg < today:
            raise HTTPException(status_code=422, detail="Registration deadline cannot be in the past.")

    # If online was flipped off (or is off and no city), city becomes required.
    new_online = changes.get("online", event.online)
    new_city = changes.get("city", event.city)
    if new_online is False and not (new_city and str(new_city).strip()):
        raise HTTPException(status_code=422, detail="City is required for in-person events.")

    # Coerce URL to string for storage.
    if "source_url" in changes and changes["source_url"] is not None:
        changes["source_url"] = str(changes["source_url"])

    # Apply the changes onto the doc.
    for field, value in changes.items():
        if field in {"date", "end_date", "registration_deadline"} and value is not None:
            from datetime import datetime as _dt, time as _time
            value = _dt.combine(value, _time.min)
        setattr(event, field, value)

    # Re-embed only if the semantic content changed.
    if any(k in changes for k in ("title", "description", "tags", "type")):
        embed_text = f"{event.title}. Category: {event.type}. {event.description} Topics: {', '.join(event.tags or [])}"
        try:
            event.embedding = embed_texts([embed_text])[0]
        except Exception:
            raise HTTPException(status_code=502, detail="Could not re-embed the event - try again.")

    # Refresh the stored display name from the current token so a user who
    # renamed themselves in Supabase gets the new name on their events.
    event.user_name = user.name or (user.email.split("@")[0] if user.email else event.user_name)
    event.user_email = user.email or event.user_email
    event.updated_at = datetime.now(timezone.utc)
    await event.save()
    return _to_out(event)


@router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: str, user: CurrentUser = Depends(require_user)):
    """Unpublish an event you posted."""
    from beanie import PydanticObjectId

    try:
        oid = PydanticObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event id")

    event = await Event.get(oid)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only unpublish your own events.")
    await event.delete()
    return None


@router.get("", response_model=list[EventOut])
async def list_events(
    type: Optional[EventType] = Query(None, description="Filter by event type"),
    online: Optional[bool] = Query(None, description="Filter online / in-person"),
    city: Optional[str] = Query(None, max_length=80, description="Filter by city (case-insensitive)"),
):
    """Return stored events (structured filters), soonest first."""
    query: dict = {}
    if type is not None:
        query["type"] = type
    if online is not None:
        query["online"] = online

    events = await Event.find(query).sort("+date").to_list()

    if city is not None:
        events = [e for e in events if (e.city or "").lower() == city.lower()]

    return [_to_out(e) for e in events]


@router.get("/search", response_model=list[EventOut])
async def search_events(
    q: str = Query(..., min_length=1, max_length=200, description="Natural-language search query"),
    type: Optional[EventType] = Query(None, description="Optional category filter"),
):
    """Semantic search - ranks events by meaning, not exact keywords."""
    events = await semantic_search(q, type=type)
    return [_to_out(e) for e in events]


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: str):
    from beanie import PydanticObjectId

    try:
        oid = PydanticObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event id")

    event = await Event.get(oid)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_out(event)
