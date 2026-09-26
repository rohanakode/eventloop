"""Unstop source (hackathons for Indian students + professionals).

Unstop (https://unstop.com) exposes a public JSON search API that its own
frontend calls -- no auth or cookies needed. We hit the hackathons endpoint and
normalize each opportunity into an EventBase.

Why this scraper is more involved than the others
--------------------------------------------------
Unstop lists *registration opportunities*, not clean calendar events, so its
structured data does NOT line up with our EventBase the way Devfolio/Meetup do:

- `end_date` is the REGISTRATION DEADLINE (same as regnRequirements.end_regn_dt),
  NOT the date the hackathon happens. The real event date usually appears only in
  the free-text `details` (e.g. "Dates: 5th & 6th December 2026"). So we:
    * PARSE the event date out of the description, and
    * map `end_date` to `registration_deadline` (which is what it actually is),
    * DROP the event when no real date can be parsed, so we never show a
      misleading (registration-deadline-as-event) date.

- `region` ("online"/"offline"/"hybrid") is unreliable for hackathons that run
  online qualifier rounds then an offline finale. So we decide online/city from
  the description's "Mode:" line and the structured venue city, not `region`
  alone.

Only fetch + normalize here. Filtering (Hyderabad + online, expiry) and
de-duplication happen later in the pipeline.
"""
from __future__ import annotations

import html
import re
from datetime import date

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
_TAG_RE = re.compile(r"<[^>]+>")

# --- date parsing from the free-text description ---------------------------
_MONTHS = {
    **{m: i for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)},
    **{m: i for i, m in enumerate(
        ["january", "february", "march", "april", "may", "june", "july", "august",
         "september", "october", "november", "december"], 1)},
}
_SEP = r"(?:\s*(?:&|and|,|to|[-–—])?\s*\d{1,2}(?:st|nd|rd|th)?)?"  # optional 2nd day of a range
# "5th December 2026", "5th & 6th December 2026", "5-6 December 2026"
_DAY_FIRST = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?{_SEP}\s+([a-z]{{3,9}})\.?\s+(\d{{4}})\b", re.I)
# "December 5, 2026", "December 5-6 2026"
_MONTH_FIRST = re.compile(rf"\b([a-z]{{3,9}})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?{_SEP},?\s+(\d{{4}})\b", re.I)
_MODE_RE = re.compile(r"mode\s*[:\-]?\s*(online|offline|hybrid)", re.I)


def _plaintext(details: str | None) -> str:
    """HTML -> plain text, keeping punctuation (so date/mode phrases survive)."""
    return re.sub(r"\s+", " ", _TAG_RE.sub(" ", html.unescape(details or ""))).strip()


def _mk_date(day: str, month: str, year: str) -> date | None:
    mon = _MONTHS.get(month.lower())
    if not mon:
        return None
    try:
        return date(int(year), mon, int(day))
    except ValueError:
        return None


def _event_dates(text: str) -> list[date]:
    """Every valid calendar date mentioned in the description text."""
    found: list[date] = []
    for d, m, y in _DAY_FIRST.findall(text):
        dt = _mk_date(d, m, y)
        if dt:
            found.append(dt)
    for m, d, y in _MONTH_FIRST.findall(text):
        dt = _mk_date(d, m, y)
        if dt:
            found.append(dt)
    return found


def _pick_event_date(text: str, deadline: date | None, today: date) -> date | None:
    """Choose the event date from the description, or None if we can't trust one.

    A hackathon happens on/after registration closes, so a valid event date must
    be at or after the deadline. We take the earliest parsed date that satisfies
    that. If the description has no such date, we return None (and the caller
    drops the event) rather than trusting an unrelated date mentioned in the
    text -- this is what keeps false dates off the site."""
    future = sorted(d for d in _event_dates(text) if d >= today)
    if not future:
        return None
    if deadline is None:
        return future[0]
    after = [d for d in future if d >= deadline]
    return after[0] if after else None


def _strip_html(text: str | None, limit: int = 500) -> str:
    plain = _plaintext(text)
    return plain[:limit].rstrip() + ("…" if len(plain) > limit else "")


class UnstopSource(EventSource):
    name = "unstop"

    def __init__(self, pages: int = 2, per_page: int = 50, city_label: str = "Hyderabad"):
        self.pages = pages
        self.per_page = per_page
        self.city_label = city_label

    def fetch(self) -> list[EventBase]:
        today = date.today()
        events: list[EventBase] = []
        for page in range(1, self.pages + 1):
            for opp in self._fetch_page(page):
                event = self._normalize(opp, today)
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

    def _normalize(self, opp: dict, today: date) -> EventBase | None:
        title = (opp.get("title") or "").strip()
        # `end_date` is the registration deadline, NOT the event date.
        deadline = iso_to_ist_date(opp.get("end_date"))
        details = opp.get("details")
        plain = _plaintext(details)

        # Real event date: parse it from the description. Unstop's structured
        # `end_date` is the registration deadline, not the event date, so if we
        # can't find a real date in the text we DROP the event rather than show
        # a misleading one.
        event_date = _pick_event_date(plain, deadline, today)
        if not title or event_date is None:
            return None

        online, city = self._resolve_location(opp, plain)

        url = opp.get("short_url") or (
            f"https://unstop.com/{opp['public_url']}" if opp.get("public_url") else None
        )

        return EventBase(
            title=title,
            description=_strip_html(details) or "Hackathon on Unstop.",
            type="hackathon",
            date=event_date,
            registration_deadline=deadline,
            city=city,
            online=online,
            source=self.name,
            source_url=url,
            tags=["hackathon"],
        )

    def _resolve_location(self, opp: dict, plain: str) -> tuple[bool, str | None]:
        """Decide online + city from the venue and the description's 'Mode:'
        line, because Unstop's `region` misreports hybrid hackathons.

        Rules: an explicit "Mode: online" (or online region with no venue) is
        online. Anything with a physical venue city is treated as in-person at
        that city -- Hyderabad ones are kept, other cities get dropped by the
        pipeline filter."""
        addr = opp.get("address_with_country_logo") or {}
        venue_city = (addr.get("city") or "").strip()
        region = (opp.get("region") or "").lower()
        mode_match = _MODE_RE.search(plain)
        mode = mode_match.group(1).lower() if mode_match else None

        online = mode == "online" or (mode is None and region == "online" and not venue_city)
        if online:
            return True, None

        # In-person: use the venue city. Normalize to our label when it's ours.
        if venue_city and "hyderabad" in venue_city.lower():
            return False, self.city_label
        if not venue_city and "hyderabad" in f"{opp.get('public_url', '')} {plain}".lower():
            return False, self.city_label
        return False, (venue_city or None)
