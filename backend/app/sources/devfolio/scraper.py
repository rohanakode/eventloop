"""Devfolio hackathon source.

Devfolio (https://devfolio.co/hackathons) is a Next.js app that server-renders
its hackathon list into a `__NEXT_DATA__` JSON blob. We fetch the page, pull
that JSON, and normalize each hackathon into an `EventBase`.

We only fetch + normalize here. Filtering (Hyderabad + online, career-only,
expiry) and de-duplication happen later in the pipeline.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime

import httpx

from app.schemas.event import EventBase
from app.sources.base import EventSource

HACKATHONS_URL = "https://devfolio.co/hackathons"
_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S
)
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    )
}


def _to_date(value: str | None) -> date | None:
    """Parse an ISO timestamp like '2026-10-08T04:30:00+00:00' into a date."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


class DevfolioSource(EventSource):
    name = "devfolio"

    def fetch(self) -> list[EventBase]:
        raw_hackathons = self._fetch_raw()
        events: list[EventBase] = []
        for h in raw_hackathons:
            event = self._normalize(h)
            if event is not None:
                events.append(event)
        return events

    # --- internal helpers -------------------------------------------------

    def _fetch_raw(self) -> list[dict]:
        """Fetch the page and return the open + upcoming hackathon dicts."""
        resp = httpx.get(HACKATHONS_URL, headers=_HEADERS, timeout=20, follow_redirects=True)
        resp.raise_for_status()

        match = _NEXT_DATA_RE.search(resp.text)
        if not match:
            return []

        data = json.loads(match.group(1))
        buckets = (
            data["props"]["pageProps"]["dehydratedState"]["queries"][0]["state"]["data"]
        )
        # Only currently-relevant hackathons (skip past/featured duplicates).
        return [*buckets.get("open_hackathons", []), *buckets.get("upcoming_hackathons", [])]

    def _normalize(self, h: dict) -> EventBase | None:
        """Map one Devfolio hackathon into our EventBase shape."""
        name = h.get("name")
        starts_at = _to_date(h.get("starts_at"))
        if not name or starts_at is None:
            return None  # skip broken records (missing title/date)

        slug = h.get("slug")
        settings = h.get("settings") or {}
        theme_names = [
            t["theme"]["name"]
            for t in (h.get("themes") or [])
            if t.get("theme", {}).get("name")
        ]

        return EventBase(
            title=name,
            description=self._build_description(theme_names, h.get("is_online", False)),
            type="hackathon",
            date=starts_at,
            registration_deadline=_to_date(settings.get("reg_ends_at")),
            city=None,  # Devfolio's list doesn't expose a city
            online=bool(h.get("is_online")),
            source=self.name,
            source_url=f"https://{slug}.devfolio.co" if slug else settings.get("site"),
            tags=[*theme_names, "hackathon"],
        )

    @staticmethod
    def _build_description(theme_names: list[str], is_online: bool) -> str:
        mode = "Online" if is_online else "In-person"
        if theme_names:
            return f"{mode} hackathon. Themes: {', '.join(theme_names)}."
        return f"{mode} hackathon on Devfolio."
