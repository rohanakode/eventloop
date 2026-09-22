"""Meetup source (Hyderabad tech/career events).

Meetup's `/find/` page is a Next.js app that embeds an Apollo GraphQL cache in
`__NEXT_DATA__`. We fetch that page for a location + keyword, read the cached
`Event` objects, and normalize them into `EventBase`.

Only fetch + normalize here. Filtering and de-dup happen in the pipeline.
"""
from __future__ import annotations

import json
import re

import httpx

from app.schemas.event import EventBase, EventType
from app.sources.base import EventSource
from app.utils.dates import iso_to_ist_date

FIND_URL = "https://www.meetup.com/find/"
_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S
)
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    )
}


def _clean(text: str | None, limit: int = 500) -> str:
    """Strip Markdown formatting and collapse whitespace into clean prose."""
    if not text:
        return ""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # [label](url) -> label
    text = re.sub(r"[*_`#>~]+", "", text)                 # bold/italic/heading/quote marks
    text = re.sub(r"\s+", " ", text).strip()              # collapse whitespace
    return text[:limit].rstrip() + ("…" if len(text) > limit else "")


def _infer_type(text: str) -> EventType:
    t = text.lower()
    if "hackathon" in t:
        return "hackathon"
    if any(w in t for w in ("workshop", "bootcamp", "hands-on", "training")):
        return "workshop"
    if any(w in t for w in ("conference", "summit", "devfest", "conf")):
        return "conference"
    if any(w in t for w in ("startup", "founder", "pitch", "demo day")):
        return "startup"
    if any(w in t for w in ("communication", "public speaking", "soft skill")):
        return "communication"
    return "networking"


class MeetupSource(EventSource):
    name = "meetup"

    def __init__(
        self,
        location: str = "in--Hyderabad",
        keywords: str = "tech",
        city_label: str = "Hyderabad",
    ):
        self.location = location
        self.keywords = keywords
        # We query by location, so physical results belong to this city. We tag
        # them with `city_label` rather than trusting the venue's locality string
        # (which is often a neighbourhood like "Nanakramguda").
        self.city_label = city_label

    def fetch(self) -> list[EventBase]:
        apollo = self._fetch_apollo()
        events: list[EventBase] = []
        for key, obj in apollo.items():
            if not key.startswith("Event:"):
                continue
            event = self._normalize(obj, apollo)
            if event is not None:
                events.append(event)
        return events

    # --- internal helpers -------------------------------------------------

    def _fetch_apollo(self) -> dict:
        params = {"location": self.location, "source": "EVENTS", "keywords": self.keywords}
        resp = httpx.get(
            FIND_URL, params=params, headers=_HEADERS, timeout=25, follow_redirects=True
        )
        resp.raise_for_status()
        match = _NEXT_DATA_RE.search(resp.text)
        if not match:
            return {}
        data = json.loads(match.group(1))
        return data["props"]["pageProps"].get("__APOLLO_STATE__", {})

    def _normalize(self, ev: dict, apollo: dict) -> EventBase | None:
        title = ev.get("title")
        event_date = iso_to_ist_date(ev.get("dateTime"))
        if not title or event_date is None:
            return None

        group_name = self._resolve_group_name(ev.get("group"), apollo)
        is_online = ev.get("eventType") == "ONLINE"

        return EventBase(
            title=title,
            description=_clean(ev.get("description")) or "Meetup event.",
            type=_infer_type(f"{title} {group_name or ''}"),
            date=event_date,
            registration_deadline=None,  # Meetup: register until event date
            city=None if is_online else self._resolve_city(ev.get("venue") or {}),
            online=is_online,
            source=self.name,
            source_url=ev.get("eventUrl"),
            tags=[group_name] if group_name else [],
        )

    def _resolve_city(self, venue: dict) -> str | None:
        """Tag as our target city only if the venue is actually there.

        Meetup's location search can return nearby/other-city events, so we
        check the real address rather than trusting the search location.
        Returns the target city label for genuine matches, else the real city
        (which the pipeline filter will then drop).
        """
        loc = " ".join(str(venue.get(k, "")) for k in ("address", "city", "state")).lower()
        if "hyderabad" in loc or "telangana" in loc:
            return self.city_label
        return venue.get("city") or None

    @staticmethod
    def _resolve_group_name(group: dict | None, apollo: dict) -> str | None:
        if isinstance(group, dict) and "__ref" in group:
            return apollo.get(group["__ref"], {}).get("name")
        return None
