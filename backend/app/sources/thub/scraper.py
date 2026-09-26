"""T-Hub source (Hyderabad startup/tech events).

T-Hub (https://t-hub.co) publishes its events through an embedded Zoho Creator
calendar. The embed URL returns the records server-side in the page HTML, so we
fetch it (no auth) and parse the calendar event objects.

What the source data does and doesn't give us:
  - HAS: title, real start + end date/time.
  - LACKS: a real description (the field just repeats the title), an
    online/offline flag, and any per-event registration link.

So, following the project's rules within those limits:
  - dates come straight from the source (start -> `date`, end -> `end_date`);
  - events are tagged in-person at T-Hub, Hyderabad (unless the title says
    online/virtual), so they pass the Hyderabad filter;
  - `source_url` points to T-Hub's events page (there's no per-event link);
  - `type` is inferred from the title; and we keep ONLY clearly tech/startup
    events, because the same calendar also holds internal ops (student visits,
    co-working orientations, AGMs, college workshops) that aren't for our users.

Dedup, description cleaning, filtering and expiry are handled by the pipeline.
"""
from __future__ import annotations

import html
import re
from datetime import date, datetime

import httpx

from app.schemas.event import EventBase

from app.sources.base import EventSource

EMBED_URL = (
    "https://creatorapp.zohopublic.com/thubcat/event-manager/report-embed/"
    "Events_Calendar1/MeMHuvkHuADwezM5Ftfyx466XMwBuwy3fE2U9w0d1r98JTCxg5HHhWUJMphOPjad46vd1W0812uOvf2Ufy3VnQ3s1d1fWWQAyxbK"
)
EVENTS_PAGE = "https://t-hub.co/events-calendar"
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    ),
    "Accept": "text/html",
}

# One calendar event object -> its start, title, end.
_EVENT_RE = re.compile(r'"start":"([^"]+)"[^}]*?"title":"([^"]+)"[^}]*?"end":"([^"]+)"')

# Keep clearly tech/startup events; drop T-Hub's internal/admin calendar entries.
_TECH_RE = re.compile(
    r"hackathon|\bhack\b|meetup|workshop|bootcamp|summit|conference|fireside|"
    r"demo\s*day|pitch|startup|founder|\bai\b|roundtable|masterclass|innovation|"
    r"accelerator|cohort|\bama\b|web3|nvidia|conclave|ideathon|demo",
    re.I,
)
_INTERNAL_RE = re.compile(
    r"student visit|co-?working|orientation|general body|\bagm\b|memorial|officer|"
    r"delegation|immersion|junior college|degree college|school of|visit for|"
    r"road show|programme|ni-msme|flea market|theatre",
    re.I,
)
_ONLINE_RE = re.compile(r"online|virtual|webinar", re.I)


def _clean_title(raw: str) -> str:
    """Decode \\uXXXX + HTML entities and normalize whitespace."""
    t = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), raw)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t).strip()


def _parse_date(raw: str) -> date | None:
    """'09\\/08\\/2026 11:30 AM' -> date(2026, 9, 8)."""
    s = raw.replace("\\", "").strip()
    for fmt in ("%m/%d/%Y %I:%M %p", "%m/%d/%Y"):
        try:
            return datetime.strptime(s if fmt.endswith("%p") else s.split()[0], fmt).date()
        except (ValueError, IndexError):
            continue
    return None


def _infer_type(title: str) -> str:
    t = title.lower()
    if "hackathon" in t or re.search(r"\bhack\b", t):
        return "hackathon"
    if any(w in t for w in ("workshop", "bootcamp", "masterclass", "hands-on")):
        return "workshop"
    if any(w in t for w in ("summit", "conference", "conclave", "meetup")):
        return "conference"
    if any(w in t for w in ("demo day", "pitch", "startup", "founder", "accelerator",
                            "cohort", "ideathon")):
        return "startup"
    return "networking"  # fireside chats, AMAs, roundtables, community talks


class THubSource(EventSource):
    name = "thub"

    def __init__(self, city_label: str = "Hyderabad"):
        self.city_label = city_label

    def fetch(self) -> list[EventBase]:
        page = self._fetch_html()
        # The records are embedded as escaped JSON; unescape quotes so the
        # per-event regex can read them.
        page = re.sub(r'\\+"', '"', page)

        events: list[EventBase] = []
        seen: set[str] = set()
        for match in _EVENT_RE.finditer(page):
            event = self._normalize(match.group(1), match.group(2), match.group(3), seen)
            if event is not None:
                events.append(event)
        return events

    # --- internal helpers -------------------------------------------------

    def _fetch_html(self) -> str:
        resp = httpx.get(EMBED_URL, headers=_HEADERS, timeout=25, follow_redirects=True)
        resp.raise_for_status()
        return resp.text

    def _normalize(self, start_raw: str, title_raw: str, end_raw: str,
                   seen: set[str]) -> EventBase | None:
        title = _clean_title(title_raw)
        if not title:
            return None

        # Keep only clearly tech/startup events, not internal ops.
        if not _TECH_RE.search(title) or _INTERNAL_RE.search(title):
            return None

        start = _parse_date(start_raw)
        if start is None:
            return None
        end = _parse_date(end_raw)

        key = f"{title.lower()}|{start.isoformat()}"
        if key in seen:
            return None
        seen.add(key)

        online = bool(_ONLINE_RE.search(title))
        return EventBase(
            title=title,
            description="An event hosted at T-Hub, Hyderabad. See T-Hub's events calendar for details.",
            type=_infer_type(title),
            date=start,
            end_date=end if (end and end != start) else None,
            registration_deadline=None,
            city=None if online else self.city_label,
            online=online,
            source=self.name,
            source_url=EVENTS_PAGE,
            tags=["T-Hub"],
        )
