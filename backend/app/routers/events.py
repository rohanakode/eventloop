"""Events endpoints — read from MongoDB (Atlas)."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.event import Event
from app.schemas.event import EventOut, EventType

router = APIRouter(prefix="/events", tags=["events"])


def _to_out(e: Event) -> EventOut:
    return EventOut(
        id=str(e.id),
        title=e.title,
        description=e.description,
        type=e.type,
        date=e.date.date(),
        registration_deadline=(
            e.registration_deadline.date() if e.registration_deadline else None
        ),
        city=e.city,
        online=e.online,
        source=e.source,
        source_url=e.source_url,
        tags=e.tags,
    )


@router.get("", response_model=list[EventOut])
async def list_events(
    type: Optional[EventType] = Query(None, description="Filter by event type"),
    online: Optional[bool] = Query(None, description="Filter online / in-person"),
    city: Optional[str] = Query(None, description="Filter by city (case-insensitive)"),
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
