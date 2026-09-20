"""The Event database model (Beanie document stored in MongoDB).

Dates are stored as `datetime` because MongoDB/BSON has no plain `date` type.
`dedup_key` is unique so re-running ingestion updates events instead of
duplicating them.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Optional

import pymongo
from beanie import Document
from pydantic import Field

from app.schemas.event import EventBase


def _to_datetime(value: date | None) -> datetime | None:
    return datetime.combine(value, time.min) if value else None


class Event(Document):
    title: str
    description: str
    type: str
    date: datetime                              # event start
    registration_deadline: Optional[datetime] = None
    city: Optional[str] = None
    online: bool = False
    source: str
    source_url: Optional[str] = None
    tags: list[str] = []
    embedding: Optional[list[float]] = None     # filled in a later step
    dedup_key: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "events"
        indexes = [
            pymongo.IndexModel("dedup_key", unique=True),
            "date",
            "type",
        ]

    @classmethod
    def from_base(cls, base: EventBase, dedup_key: str) -> "Event":
        return cls(
            title=base.title,
            description=base.description,
            type=base.type,
            date=_to_datetime(base.date),
            registration_deadline=_to_datetime(base.registration_deadline),
            city=base.city,
            online=base.online,
            source=base.source,
            source_url=base.source_url,
            tags=base.tags,
            dedup_key=dedup_key,
        )
