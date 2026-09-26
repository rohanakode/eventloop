"""Filters that decide which fetched events are allowed into the database.

Rules (all must pass):
- career-only  : the event type is one of our career categories
- hyderabad/online : the event is online, or its city is Hyderabad
- active       : registration is still open (deadline, else event date, >= today)

Non-career / other-city / expired events are simply not stored.
"""
from __future__ import annotations

from datetime import date

from app.schemas.event import EventBase

CAREER_TYPES = {
    "hackathon",
    "networking",
    "startup",
    "conference",
    "workshop",
    "communication",
}


def is_career(event: EventBase) -> bool:
    return event.type in CAREER_TYPES


def is_hyderabad_or_online(event: EventBase) -> bool:
    if event.online:
        return True
    if not event.city:
        return False
    return "hyderabad" in event.city.lower()


def is_active(event: EventBase, today: date | None = None) -> bool:
    """Active = the event hasn't finished AND registration hasn't closed.

    Uses the end date when present so a multi-day event stays live until it
    actually ends, not the moment it starts."""
    today = today or date.today()
    effective_end = event.end_date or event.date
    if effective_end is None or effective_end < today:
        return False  # event is over
    if event.registration_deadline is not None and event.registration_deadline < today:
        return False  # registration closed
    return True


def passes(event: EventBase, today: date | None = None) -> bool:
    return (
        is_career(event)
        and is_hyderabad_or_online(event)
        and is_active(event, today)
    )
