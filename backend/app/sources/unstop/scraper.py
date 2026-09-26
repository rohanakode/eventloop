"""Unstop source (hackathons for Indian students + professionals).

Unstop (https://unstop.com) exposes a public JSON search API that its own
frontend calls -- no auth or cookies needed. We hit the hackathons endpoint and
normalize each opportunity into an EventBase.

Date handling: Unstop is registration-deadline driven. An opportunity's `start`
is often already in the past while registration is still open, so we use
`end_date` (which stays in the future for open opportunities) as the event date.
Using `start` would make the pipeline's "active" filter wrongly drop still-open
hackathons.

Location: the list endpoint omits a clean city, so we keep online/hybrid events
(accessible from anywhere) and only tag an offline event as Hyderabad when its
slug/title clearly says so. Other offline events (Delhi, Mumbai, ...) get no
city and the pipeline filter drops them.

Only fetch + normalize here. Filtering (Hyderabad + online, expiry) and
de-duplication happen later in the pipeline.
"""
from __future__ import annotations

import re

import httpx

from app.schemas.event import EventBase
from app.sources.base import EventSource
from app.utils.dates import iso_to_ist_date

API_URL = "https://unstop.com/api/public/opportunity/search-result"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    ),
    "Accept": "application/json",
}
_TAG_RE = re.compile(r"<[^>]+>")          # strip HTML tags from `details`
_ENTITY_RE = re.compile(r"&[a-z]+;")      # &nbsp; &amp; etc.


def _strip_html(text: str | None, limit: int = 500) -> str:
    """Turn Unstop's HTML `details` into clean, length-capped prose."""
    if not text:
        return ""
    text = _ENTITY_RE.sub(" ", _TAG_RE.sub(" ", text))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].rstrip() + ("…" if len(text) > limit else "")


class UnstopSource(EventSource):
    name = "unstop"

    def __init__(self, pages: int = 2, per_page: int = 50, city_label: str = "Hyderabad"):
        self.pages = pages
        self.per_page = per_page
        self.city_label = city_label

    def fetch(self) -> list[EventBase]:
        events: list[EventBase] = []
        for page in range(1, self.pages + 1):
            for opp in self._fetch_page(page):
                event = self._normalize(opp)
                if event is not None:
                    events.append(event)
        return events

    # --- internal helpers -------------------------------------------------

    def _fetch_page(self, page: int) -> list[dict]:
        params = {
            "opportunity": "hackathons",
            "page": page,
            "per_page": self.per_page,
            "oppstatus": "open",
        }
        resp = httpx.get(API_URL, params=params, headers=_HEADERS, timeout=25, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json().get("data") or {}
        return data.get("data") or []

    def _normalize(self, opp: dict) -> EventBase | None:
        title = (opp.get("title") or "").strip()
        # Use end_date (future for open opportunities) as the event date -- see
        # the module docstring for why `start` is unreliable here.
        end = iso_to_ist_date(opp.get("end_date"))
        if not title or end is None:
            return None

        region = (opp.get("region") or "").lower()
        online = region in ("online", "hybrid")

        slug = (opp.get("public_url") or "").lower()
        city = self.city_label if (not online and "hyderabad" in f"{slug} {title.lower()}") else None

        url = opp.get("short_url") or (
            f"https://unstop.com/{opp['public_url']}" if opp.get("public_url") else None
        )

        return EventBase(
            title=title,
            description=_strip_html(opp.get("details")) or "Hackathon on Unstop.",
            type="hackathon",
            date=end,
            registration_deadline=end,
            city=city,
            online=online,
            source=self.name,
            source_url=url,
            tags=["hackathon"],
        )
