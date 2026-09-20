"""Pydantic schemas for events (request/response shapes)."""
from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel

EventType = Literal[
    "hackathon",
    "networking",
    "startup",
    "conference",
    "workshop",
    "communication",
    "other",
]


class EventBase(BaseModel):
    title: str
    description: str
    type: EventType
    date: date                          # event start date
    registration_deadline: Optional[date] = None  # last date to register (drives expiry)
    city: Optional[str] = None
    online: bool = False
    source: str = "native"          # "native" (posted here) or a source name
    source_url: Optional[str] = None
    tags: list[str] = []


class EventOut(EventBase):
    id: str
