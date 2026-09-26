"""Unstop source (hackathons + related competitions for Indian students/pros).

Unstop (https://unstop.com) exposes public JSON APIs that its own frontend
calls -- no auth or cookies needed.

Two endpoints are used:
  1. Search list: gives the opportunities (title, region, venue, HTML details,
     topic tags). But its `end_date` is a registration/opportunity boundary, NOT
     the real event schedule, and it has no event start date.
  2. Competition detail (`/api/public/competition/{id}`): its
     `competition.rounds[].details[].start_date/end_date` are the AUTHORITATIVE
     event dates (the "Stages & Timeline" shown on the page). We use these so the
     event dates on our site match Unstop exactly.

To keep the number of detail calls sane, we first cheaply pre-filter the list to
online/hybrid or Hyderabad opportunities, then fetch the detail only for those.
An opportunity with no parseable round dates is DROPPED (we never show a guessed
or registration-deadline date).

Only fetch + normalize here. Filtering (Hyderabad + online, expiry) and
de-duplication happen later in the pipeline.
"""
from __future__ import annotations

import html
import re
from datetime import date
from html.parser import HTMLParser

import httpx

from app.schemas.event import EventBase
from app.sources.base import EventSource
from app.utils.dates import iso_to_ist_date

API_URL = "https://unstop.com/api/public/opportunity/search-result"
DETAIL_URL = "https://unstop.com/api/public/competition/{opp_id}"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    ),
    "Accept": "application/json",
}
_TAG_RE = re.compile(r"<[^>]+>")
_MODE_RE = re.compile(r"mode\s*[:\-]?\s*(online|offline|hybrid)", re.I)


class _TextExtractor(HTMLParser):
    """Collects only the visible text of an HTML fragment.

    A regex like `<[^>]+>` breaks on tags whose attributes contain '>' (e.g.
    Tailwind arbitrary-value classes `[&:has(...)>*]`, which some organizers
    paste into Unstop descriptions), leaking CSS/markup as text. A real parser
    tracks quoted attributes, so tag internals never reach the output."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        return " ".join(self._parts)


def _plaintext(details: str | None) -> str:
    """HTML -> visible plain text, keeping punctuation."""
    if not details:
        return ""
    parser = _TextExtractor()
    try:
        parser.feed(details)
        text = parser.get_text()
    except Exception:
        text = _TAG_RE.sub(" ", html.unescape(details))  # last-resort fallback
    return re.sub(r"\s+", " ", text).strip()


def _strip_html(text: str | None, limit: int = 500) -> str:
    plain = _plaintext(text)
    return plain[:limit].rstrip() + ("…" if len(plain) > limit else "")


def _infer_type(title: str, description: str) -> str:
    """Unstop's 'hackathons' listing also contains non-hackathons (pitch events,
    ideathons, competitions). Infer the real category from the text instead of
    assuming hackathon."""
    t = f"{title} {description}".lower()
    if "hackathon" in t or re.search(r"\bhack(?:s|athon|-)?\b", t) or "coding challenge" in t:
        return "hackathon"
    if any(w in t for w in ("workshop", "bootcamp", "masterclass", "training", "hands-on")):
        return "workshop"
    if any(w in t for w in ("conference", "summit", "conclave", "devfest", "meetup")):
        return "conference"
    if any(w in t for w in ("pitch", "startup", "founder", "demo day", "ideathon",
                            "business plan", "b-plan", "stall", "entrepreneur", "launch")):
        return "startup"
    return "hackathon"  # default: it came from the hackathons listing


def _round_date_range(competition: dict) -> tuple[date | None, date | None]:
    """The real event start/end from the competition's rounds (the source of
    truth for dates). Spans all rounds: earliest start to latest end."""
    starts: list[date] = []
    ends: list[date] = []
    for rnd in competition.get("rounds") or []:
        for det in rnd.get("details") or []:
            s = iso_to_ist_date(det.get("start_date"))
            e = iso_to_ist_date(det.get("end_date"))
            if s:
                starts.append(s)
            if e:
                ends.append(e)
    return (min(starts) if starts else None, max(ends) if ends else None)


class UnstopSource(EventSource):
    name = "unstop"

    def __init__(self, pages: int = 4, per_page: int = 50, city_label: str = "Hyderabad",
                 max_details: int = 60):
        self.pages = pages
        self.per_page = per_page
        self.city_label = city_label
        # Cap on per-event detail API calls per run, to bound scrape time.
        self.max_details = max_details

    def fetch(self) -> list[EventBase]:
        today = date.today()
        # 1) Collect list candidates, cheaply pre-filtered to bound detail calls.
        candidates: list[dict] = []
        for page in range(1, self.pages + 1):
            candidates.extend(o for o in self._fetch_page(page) if self._is_relevant(o))
        candidates = candidates[: self.max_details]

        # 2) Fetch each candidate's detail for authoritative dates + normalize.
        events: list[EventBase] = []
        for opp in candidates:
            event = self._normalize(opp, today)
            if event is not None:
                events.append(event)
        return events

    # --- internal helpers -------------------------------------------------

    def _fetch_page(self, page: int) -> list[dict]:
        params = {"opportunity": "hackathons", "page": page,
                  "per_page": self.per_page, "oppstatus": "open"}
        resp = httpx.get(API_URL, params=params, headers=_HEADERS, timeout=25, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json().get("data") or {}
        return data.get("data") or []

    def _fetch_detail(self, opp_id) -> dict | None:
        if not opp_id:
            return None
        try:
            resp = httpx.get(DETAIL_URL.format(opp_id=opp_id), headers=_HEADERS,
                             timeout=25, follow_redirects=True)
            resp.raise_for_status()
            return (resp.json().get("data") or {}).get("competition")
        except Exception:
            return None  # a flaky detail call just drops that one event

    def _is_relevant(self, opp: dict) -> bool:
        """Cheap pre-filter on list data so we only fetch details for events that
        could pass the pipeline's Hyderabad-or-online rule."""
        region = (opp.get("region") or "").lower()
        addr = opp.get("address_with_country_logo") or {}
        city = (addr.get("city") or "").lower()
        slug = (opp.get("public_url") or "").lower()
        return region in ("online", "hybrid") or "hyderabad" in f"{city} {slug}"

    def _normalize(self, opp: dict, today: date) -> EventBase | None:
        title = (opp.get("title") or "").strip()
        if not title:
            return None

        competition = self._fetch_detail(opp.get("id"))
        if not competition:
            return None
        start, end = _round_date_range(competition)
        if start is None:
            return None  # no authoritative date -> drop (never guess)
        if (end or start) < today:
            return None  # event already over

        plain = _plaintext(opp.get("details"))
        online, city = self._resolve_location(opp, plain)
        url = opp.get("short_url") or (
            f"https://unstop.com/{opp['public_url']}" if opp.get("public_url") else None
        )
        topics = [w.get("name") for w in (opp.get("workfunction") or []) if w.get("name")]

        return EventBase(
            title=title,
            description=_strip_html(opp.get("details")) or "Opportunity on Unstop.",
            type=_infer_type(title, plain),
            date=start,
            end_date=end if (end and end != start) else None,
            registration_deadline=None,
            city=city,
            online=online,
            source=self.name,
            source_url=url,
            tags=topics,
        )

    def _resolve_location(self, opp: dict, plain: str) -> tuple[bool, str | None]:
        """Online + city from the venue and the description's 'Mode:' line
        (Unstop's `region` misreports hybrid hackathons)."""
        addr = opp.get("address_with_country_logo") or {}
        venue_city = (addr.get("city") or "").strip()
        region = (opp.get("region") or "").lower()
        mode_match = _MODE_RE.search(plain)
        mode = mode_match.group(1).lower() if mode_match else None

        online = mode == "online" or (mode is None and region == "online" and not venue_city)
        if online:
            return True, None
        if venue_city and "hyderabad" in venue_city.lower():
            return False, self.city_label
        if not venue_city and "hyderabad" in f"{opp.get('public_url', '')} {plain}".lower():
            return False, self.city_label
        return False, (venue_city or None)
