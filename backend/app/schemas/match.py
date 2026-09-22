"""Schemas for the resume-matching feature."""
from pydantic import BaseModel

from app.schemas.event import EventOut


class Profile(BaseModel):
    headline: str = ""
    skills: list[str] = []
    interests: list[str] = []
    stage: str = "unknown"
    goal: str = ""


class MatchedEvent(BaseModel):
    event: EventOut
    score: float           # 0..1 similarity
    reason: str            # human-readable "why this matched"


class MatchGroup(BaseModel):
    type: str              # category (hackathon, networking, ...)
    matches: list[MatchedEvent]


class MatchResponse(BaseModel):
    profile: Profile       # what we understood from the resume
    intent: str | None = None
    matches: list[MatchedEvent]        # flat top-N (kept for compatibility)
    groups: list[MatchGroup] = []      # top matches per category — for a balanced feed
