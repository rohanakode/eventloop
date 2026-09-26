"""Pydantic schemas for events (request/response shapes)."""
import re
from datetime import date as _date, timedelta
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

# Re-exported for downstream imports that expect `schemas.event.date`.
date = _date

EventType = Literal[
    "hackathon",
    "networking",
    "startup",
    "conference",
    "workshop",
    "communication",
    "other",
]

# Longest sensible event horizon. Blocks accidental `9999-…` typos, and also
# stops someone from parking spam events decades in the future.
MAX_YEARS_AHEAD = 3
URL_MAX = 500

_ALPHANUM_RE = re.compile(r"[A-Za-z0-9]")


def _future_cutoff() -> _date:
    return _date.today() + timedelta(days=365 * MAX_YEARS_AHEAD)


def _clean_tags(raw: list[str] | None) -> list[str]:
    """Strip, drop blanks / character-less tags, and dedupe case-insensitively."""
    if not raw:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for t in raw:
        s = (t or "").strip()
        if not s or not _ALPHANUM_RE.search(s):
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


class EventBase(BaseModel):
    """Lenient shape used by the ingestion pipeline and stored as EventOut.

    User-posted events go through UserEventCreate (stricter), which converts
    to this before hitting the database.
    """
    title: str
    description: str
    type: EventType
    date: _date                          # event start date (IST)
    end_date: Optional[_date] = None     # event end date (IST), for multi-day events
    registration_deadline: Optional[_date] = None  # last date to register (drives expiry)
    city: Optional[str] = None
    online: bool = False
    source: str = "native"          # "native" (posted here) or a source name
    source_url: Optional[str] = None
    tags: list[str] = []


class UserEventCreate(BaseModel):
    """Input schema for POST /events - the payload a signed-in user submits.

    Stricter than EventBase because we control this surface end-to-end:
    - lengths capped so the feed stays legible and the DB doesn't bloat,
    - dates sanity-checked (past, mis-ordered, or absurdly far in the future rejected),
    - source_url must actually be a URL,
    - text fields stripped so whitespace-only submissions don't slip past min_length.

    Ingestion sources are trusted (their events go straight to EventBase), so
    those rules would be too strict there.
    """
    title: Annotated[str, Field(min_length=3, max_length=120)]
    description: Annotated[str, Field(min_length=20, max_length=2000)]
    type: EventType
    date: _date
    end_date: Optional[_date] = None
    registration_deadline: Optional[_date] = None
    city: Annotated[Optional[str], Field(max_length=80)] = None
    online: bool = False
    # Registration link is required - an event without one has nowhere for attendees to sign up.
    source_url: Annotated[HttpUrl, Field(max_length=URL_MAX)]
    tags: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=30)]],
        Field(max_length=6),
    ] = []

    # Strip first, then re-check length. This blocks "   " passing min_length=3.
    @field_validator("title", "description", mode="before")
    @classmethod
    def _strip_required(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("city", mode="before")
    @classmethod
    def _strip_optional(cls, v):
        if not isinstance(v, str):
            return v
        s = v.strip()
        return s or None

    @model_validator(mode="after")
    def _check_dates(self):
        today = _date.today()
        cutoff = _future_cutoff()
        if self.date < today:
            raise ValueError("Event date cannot be in the past.")
        if self.date > cutoff:
            raise ValueError(f"Event date is unrealistically far away (max {MAX_YEARS_AHEAD} years ahead).")
        if self.end_date:
            if self.end_date < self.date:
                raise ValueError("End date must be on or after the start date.")
            if self.end_date > cutoff:
                raise ValueError(f"End date is unrealistically far away (max {MAX_YEARS_AHEAD} years ahead).")
        if self.registration_deadline:
            if self.registration_deadline > self.date:
                raise ValueError("Registration deadline must be on or before the event date.")
            if self.registration_deadline < today:
                raise ValueError("Registration deadline cannot be in the past.")
        return self

    @model_validator(mode="after")
    def _check_location(self):
        # If it's not online, we need a city. Otherwise attendees have no
        # idea where to show up.
        if not self.online and not (self.city and self.city.strip()):
            raise ValueError("City is required for in-person events.")
        return self

    @model_validator(mode="after")
    def _dedupe_tags(self):
        cleaned = _clean_tags(self.tags)
        if len(cleaned) > 6:
            raise ValueError("At most 6 tags.")
        # `_clean_tags` may produce a shorter list than what was submitted -
        # copy that back onto the model so downstream reads see it.
        object.__setattr__(self, "tags", cleaned)
        return self

    def to_base(self) -> EventBase:
        """Convert to the storage-facing shape."""
        return EventBase(
            title=self.title.strip(),
            description=self.description.strip(),
            type=self.type,
            date=self.date,
            end_date=self.end_date,
            registration_deadline=self.registration_deadline,
            city=(self.city or "").strip() or None,
            online=self.online,
            source="native",
            source_url=str(self.source_url) if self.source_url else None,
            tags=list(self.tags),
        )


class UserEventUpdate(BaseModel):
    """Partial update for PATCH /events/{id}. Every field is optional; only
    the ones the user sends get changed. Same length/URL/date/text rules as
    create, applied field-by-field. Cross-field rules that depend on other
    fields (city required if online=false, etc.) live in the router because
    they need to compare against the stored event."""
    title: Annotated[Optional[str], Field(default=None, min_length=3, max_length=120)] = None
    description: Annotated[Optional[str], Field(default=None, min_length=20, max_length=2000)] = None
    type: Optional[EventType] = None
    date: Optional[_date] = None
    end_date: Optional[_date] = None
    registration_deadline: Optional[_date] = None
    city: Annotated[Optional[str], Field(default=None, max_length=80)] = None
    online: Optional[bool] = None
    source_url: Annotated[Optional[HttpUrl], Field(default=None, max_length=URL_MAX)] = None
    tags: Annotated[
        Optional[list[Annotated[str, Field(min_length=1, max_length=30)]]],
        Field(default=None, max_length=6),
    ] = None

    @field_validator("title", "description", mode="before")
    @classmethod
    def _strip_required(cls, v):
        if v is None:
            return v
        return v.strip() if isinstance(v, str) else v

    @field_validator("city", mode="before")
    @classmethod
    def _strip_optional(cls, v):
        if not isinstance(v, str):
            return v
        s = v.strip()
        return s or None

    @field_validator("tags")
    @classmethod
    def _dedupe_tags(cls, v):
        if v is None:
            return v
        cleaned = _clean_tags(v)
        if len(cleaned) > 6:
            raise ValueError("At most 6 tags.")
        return cleaned

    def changed(self) -> dict:
        """Only fields the caller actually sent (excludes defaults)."""
        return self.model_dump(exclude_unset=True)


class EventOut(EventBase):
    id: str
    # Poster identifiers - only populated for user-posted (native) events.
    user_id: Optional[str] = None
    user_name: Optional[str] = None
