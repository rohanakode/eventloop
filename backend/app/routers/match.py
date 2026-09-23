"""Resume + intent -> matched events."""
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.event import Event
from app.routers.events import _to_out
from app.schemas.match import MatchGroup, MatchResponse, MatchedEvent, Profile
from app.services.embeddings import embed_query
from app.services.resume import build_query, extract_profile, extract_text, why_matches
from app.services.search import _detect_by_keyword, _detect_category

# Order categories appear in the "For you" feed.
GROUP_ORDER = ["hackathon", "startup", "workshop", "conference", "networking", "communication"]
PER_CATEGORY_LIMIT = 4

router = APIRouter(prefix="/match", tags=["match"])

VECTOR_INDEX = "vector_index"
MAX_PDF_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/resume", response_model=MatchResponse)
async def match_resume(
    resume: Optional[UploadFile] = File(None, description="PDF resume (optional)"),
    intent: Optional[str] = Form(None, max_length=500, description="What are you looking for?"),
    limit: int = Form(8),
):
    """Rank events by fit to (resume + intent). Either field is optional but
    at least one must be provided. Resume is processed in memory, never stored."""
    if not resume and not (intent and intent.strip()):
        raise HTTPException(status_code=400, detail="Provide a resume, an intent, or both.")

    # 1. Get the profile (from resume if provided, else empty)
    profile_dict: dict = {"headline": "", "skills": [], "interests": [], "stage": "unknown", "goal": ""}
    if resume is not None:
        data = await resume.read()
        if len(data) > MAX_PDF_BYTES:
            raise HTTPException(status_code=413, detail="Resume file too large (max 5 MB).")
        try:
            text = extract_text(data)
        except Exception:
            raise HTTPException(status_code=400, detail="Could not read the PDF. Is it a valid resume PDF?")
        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")
        profile_dict = extract_profile(text)

    # 2. Build query text + embed
    query_text = build_query(profile_dict, intent)
    qvec = embed_query(query_text)

    # 3. Category-aware routing: if the intent names a category (e.g.
    # "hackathon"), restrict results to that category so the intent isn't
    # drowned out by the resume's skill vector.
    target_type: Optional[str] = None
    if intent and intent.strip():
        target_type = _detect_by_keyword(intent) or _detect_category(embed_query(intent))

    # Fetch a large pool so we can pick the best matches PER category
    pipeline: list[dict] = [
        {"$vectorSearch": {"index": VECTOR_INDEX, "path": "embedding", "queryVector": qvec, "numCandidates": 200, "limit": 100}},
        {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
    ]
    if target_type:
        pipeline.append({"$match": {"type": target_type}})
    docs = await Event.get_motor_collection().aggregate(pipeline).to_list(length=100)

    def to_match(d: dict) -> MatchedEvent:
        event = Event(**d)
        event.id = d["_id"]
        event_text = f"{event.title}. {event.description} {' '.join(event.tags or [])}"
        return MatchedEvent(
            event=_to_out(event),
            score=round(float(d.get("score", 0.0)), 3),
            reason=why_matches(event_text, event.type, profile_dict, intent),
        )

    all_matches = [to_match(d) for d in docs]

    # Group per category (top PER_CATEGORY_LIMIT of each), ordered by GROUP_ORDER
    groups: list[MatchGroup] = []
    for cat in GROUP_ORDER:
        cat_matches = [m for m in all_matches if m.event.type == cat][:PER_CATEGORY_LIMIT]
        if cat_matches:
            groups.append(MatchGroup(type=cat, matches=cat_matches))

    # Flat top-N (kept so existing callers keep working)
    flat = all_matches[:limit]

    return MatchResponse(profile=Profile(**profile_dict), intent=intent, matches=flat, groups=groups)
