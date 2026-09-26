"""Teammate-interest document.

A single row says "user X is looking for teammates for event Y". The event's
title/date/city are denormalized on the row so the global /teammates listing
doesn't need to join back to the events collection on every read.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Optional

import pymongo
from beanie import Document
from pydantic import Field


def _to_datetime(value: date | None) -> datetime | None:
    return datetime.combine(value, time.min) if value else None


class TeammateInterest(Document):
    # Who is looking.
    user_id: str
    user_name: str = ""
    user_email: str = ""

    # Which event they're looking for teammates for.
    event_id: str

    # Denormalized snapshot from the event at post time - makes the global
    # /teammates listing cheap to render without a lookup.
    event_title: str
    event_type: str
    event_date: datetime          # start date
    event_city: Optional[str] = None
    event_online: bool = False

    # Their pitch and how to reach them.
    pitch: str                    # "What I bring, what I'm looking for"
    contact: str                  # email / linkedin / github / socials

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "teammate_interests"
        indexes = [
            "event_id",
            "user_id",
            "created_at",
            pymongo.IndexModel([("user_id", 1), ("event_id", 1)], unique=True),
        ]
