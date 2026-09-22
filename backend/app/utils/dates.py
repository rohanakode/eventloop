"""Date helpers. Events are shown to a Hyderabad audience, so timestamps are
interpreted in India Standard Time (IST) before we take the calendar date.

This fixes off-by-one bugs: a source that stores '2026-10-23T18:30:00+00:00'
(UTC) is actually Oct 24 in IST, which is the date users expect.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def iso_to_ist_date(value: str | None) -> date | None:
    """Parse an ISO timestamp and return its calendar date in IST."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.date()  # already local/naive — take as-is
    return dt.astimezone(IST).date()
