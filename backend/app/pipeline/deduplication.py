"""
Cross-source event de-duplication.
==================================

The problem this file solves
----------------------------
The same real-world event is often listed on more than one source: a hackathon
on both Devfolio and Unstop, a meetup on both Meetup and Luma. Each source gives
it a *different* URL, so the pipeline's exact-key matching (source_url, or
source+title+date) treats them as two separate events -- and the feed shows the
same event twice.

What this file does
-------------------
Decides whether two events are the SAME event using two gates that BOTH must pass:

  1. Date block  -> only events on the same calendar day are ever compared.
                    (Fast, and it prevents unrelated events with similar names
                    from being merged.)
  2. Fuzzy title -> normalized titles are compared with rapidfuzz. Titles that
                    are near-identical (score >= TITLE_MATCH_THRESHOLD) are
                    treated as the same event.

It is SOURCE-AGNOSTIC: it works only on the normalized fields every scraper
produces (title, date, source_url), so every current and future source is
de-duplicated automatically -- there is no per-source code here or anywhere else.

Where it runs (see pipeline/ingest.py)
--------------------------------------
  - dedupe_batch()   collapses duplicates *within* one scrape run (across sources)
  - find_duplicate() checks an incoming event against events already in the DB

Tuning
------
TITLE_MATCH_THRESHOLD is deliberately conservative: when unsure, it keeps BOTH
events rather than risk hiding a genuinely different event. Raise it to merge
less (stricter), lower it to merge more (more aggressive).
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable, Optional, Protocol

from rapidfuzz import fuzz

# A normalized-title similarity at or above this (0-100) counts as the same
# event. 88 catches "GenAI Hackathon 2026" vs "GenAI Hackathon" while staying
# clear of genuinely different events that merely share a word or two.
TITLE_MATCH_THRESHOLD = 88


class _EventLike(Protocol):
    """The fields we compare. Both EventBase (incoming, `date` is a date) and the
    Event DB document (`date` is a datetime) satisfy this, so one code path
    handles both -- see _day() for the date/datetime normalization."""
    title: str
    date: object
    source_url: Optional[str]


# Platform noise that gets bolted onto titles but doesn't identify the event.
# Stripped before comparing so "Webinar: AI 101" and "AI 101" still match.
_NOISE_PREFIXES = ("webinar:", "workshop:", "online:", "live:", "free:", "meetup:")
_BRACKETED = re.compile(r"[\[(][^\])]*[\])]")   # "[Online]", "(Virtual)"
_CITY_LABEL = re.compile(r"^[a-z ]{3,20}\s[|\-–]\s")  # "hyderabad | ..."
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
# A standalone year (e.g. "2026") is the single most common difference between
# the same event on two sources. Dropping it is safe because the date-block
# already keeps different editions apart by day.
_YEAR = re.compile(r"\b(?:19|20)\d{2}\b")


def normalize_title(title: str) -> str:
    """Lower-case and strip platform noise/punctuation so the SAME event from two
    sources normalizes to the same (or very close) string."""
    t = (title or "").lower().strip()
    t = _BRACKETED.sub(" ", t)                 # drop "[Online]" / "(Virtual)"
    for prefix in _NOISE_PREFIXES:
        if t.startswith(prefix):
            t = t[len(prefix):].strip()
    t = _CITY_LABEL.sub("", t)                 # drop a leading "city | " label
    t = _NON_ALNUM.sub(" ", t)                 # punctuation -> spaces
    t = _YEAR.sub(" ", t)                       # drop standalone years (2024, 2026, ...)
    return re.sub(r"\s+", " ", t).strip()


def _day(value) -> Optional[date]:
    """The calendar date, whether given a date or a datetime."""
    if value is None:
        return None
    return value.date() if isinstance(value, datetime) else value


def same_event(a: _EventLike, b: _EventLike, threshold: int = TITLE_MATCH_THRESHOLD) -> bool:
    """True if a and b look like the same real-world event (same day + similar title)."""
    if _day(a.date) != _day(b.date):
        return False
    score = fuzz.token_sort_ratio(normalize_title(a.title), normalize_title(b.title))
    return score >= threshold


def find_duplicate(
    candidate: _EventLike,
    existing: Iterable[_EventLike],
    threshold: int = TITLE_MATCH_THRESHOLD,
) -> Optional[_EventLike]:
    """Return the first event in `existing` that is the same as `candidate`, else None.

    `existing` is expected to already be narrowed to the candidate's date for
    speed, but same_event re-checks the date regardless, so passing more is safe."""
    for other in existing:
        if same_event(candidate, other, threshold):
            return other
    return None


def prefer(a: _EventLike, b: _EventLike) -> _EventLike:
    """Of two events that are the same, pick the one worth keeping.

    A card the user can click through is more useful, so the event WITH a
    registration link (source_url) wins. If both or neither have one, keep `a`
    (the incumbent / first seen)."""
    a_has = bool(getattr(a, "source_url", None))
    b_has = bool(getattr(b, "source_url", None))
    return b if (b_has and not a_has) else a


def dedupe_batch(events: list[_EventLike], threshold: int = TITLE_MATCH_THRESHOLD) -> list[_EventLike]:
    """Collapse same-event duplicates *within* one scrape batch (across sources).

    Groups by date first (cheap), then fuzzy-compares only within each day, and
    keeps the better of each duplicate pair (see prefer())."""
    by_day: dict[Optional[date], list[_EventLike]] = {}
    for e in events:
        by_day.setdefault(_day(e.date), []).append(e)

    kept: list[_EventLike] = []
    for day_events in by_day.values():
        day_kept: list[_EventLike] = []
        for e in day_events:
            dup = find_duplicate(e, day_kept, threshold)
            if dup is None:
                day_kept.append(e)
            elif prefer(dup, e) is e:
                day_kept[day_kept.index(dup)] = e   # incoming is better -> replace
        kept.extend(day_kept)
    return kept
