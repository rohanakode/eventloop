"""Hybrid, category-aware search over events.

- Short queries (1-2 words): fuzzy full-text match (precise keyword/category).
- Longer phrases: semantic vector search. If the phrase clearly means a
  category (e.g. "coding competition to win prizes" -> hackathon), we detect
  that and restrict results to that category, so conceptual category-queries
  don't leak other event types.
"""
import math
import re
from difflib import SequenceMatcher
from typing import Optional

from app.models.event import Event
from app.services.embeddings import embed_query, embed_texts

VECTOR_INDEX = "vector_index"
TEXT_INDEX = "text_index"
SCORE_MARGIN = 0.05     # open queries: only keep results close to the best
MIN_SCORE = 0.55
FALLBACK_LIMIT = 6

# Representative text per category, used to detect the intent of a query.
CATEGORY_HINTS = {
    "hackathon": "hackathon coding competition build a project in a team win prizes",
    "networking": "networking event meetup meet professionals community mixer",
    "workshop": "hands-on workshop training bootcamp learn a skill tutorial",
    "conference": "conference tech talks summit keynote speakers sessions",
    "startup": "startup founders pitching demo day entrepreneurs investors",
    "communication": "communication public speaking soft skills presentation",
}

# Explicit words/synonyms that clearly signal a category if present in the query.
CATEGORY_KEYWORDS = {
    "hackathon": ["hackathon", "hackathons", "coding competition"],
    "networking": ["networking", "meetup", "mixer"],
    "workshop": ["workshop", "bootcamp", "hands-on", "training"],
    "conference": ["conference", "summit", "keynote"],
    "startup": ["startup", "founder", "pitch", "demo day", "entrepreneur", "investor", "vc"],
    "communication": ["communication", "public speaking", "soft skill"],
}
_cat_vecs: Optional[dict] = None


def _detect_by_keyword(query: str) -> Optional[str]:
    """Explicit category detection — tolerant to typos/plural via edit distance
    on each word of the query."""
    q_words = [w for w in re.split(r"[^a-z]+", query.lower()) if len(w) >= 4]
    for cat, words in CATEGORY_KEYWORDS.items():
        for w in words:
            wl = w.lower()
            # exact/substring match first
            if wl in query.lower():
                return cat
            # fuzzy: any query word similar enough to a category word (typos)
            for qw in q_words:
                if len(qw) >= 5 and SequenceMatcher(None, qw, wl.split()[0]).ratio() >= 0.82:
                    return cat
    return None


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def _category_vectors() -> dict:
    global _cat_vecs
    if _cat_vecs is None:
        types = list(CATEGORY_HINTS)
        vecs = embed_texts([CATEGORY_HINTS[t] for t in types])
        _cat_vecs = dict(zip(types, vecs))
    return _cat_vecs


def _detect_category(qvec: list[float], margin: float = 0.04, floor: float = 0.45) -> Optional[str]:
    """Return a category if the query clearly means one (a clear top match)."""
    sims = sorted(
        ((t, _cosine(qvec, v)) for t, v in _category_vectors().items()),
        key=lambda x: -x[1],
    )
    (t1, s1), (_, s2) = sims[0], sims[1]
    return t1 if s1 >= floor and (s1 - s2) >= margin else None


async def _text_search(query: str, limit: int, type: Optional[str]) -> list[Event]:
    pipeline: list[dict] = [
        {
            "$search": {
                "index": TEXT_INDEX,
                "compound": {
                    "should": [
                        {"text": {"query": query, "path": ["title", "tags"], "fuzzy": {"maxEdits": 2}, "score": {"boost": {"value": 4}}}},
                        {"text": {"query": query, "path": "type", "fuzzy": {"maxEdits": 2}, "score": {"boost": {"value": 3}}}},
                        {"text": {"query": query, "path": "description", "fuzzy": {"maxEdits": 2}, "score": {"boost": {"value": 1}}}},
                    ],
                    "minimumShouldMatch": 1,
                },
            }
        },
        {"$limit": limit},
    ]
    if type:
        pipeline.append({"$match": {"type": type}})
    return await Event.aggregate(pipeline, projection_model=Event).to_list()


async def _vector_search(query: str, limit: int, type: Optional[str]) -> list[Event]:
    qvec = embed_query(query)
    strict = False
    if type is None:
        explicit = _detect_by_keyword(query)
        if explicit:
            type, strict = explicit, True  # user named a category -> show all of it
        else:
            type = _detect_category(qvec)  # inferred from meaning

    pipeline: list[dict] = [
        {"$vectorSearch": {"index": VECTOR_INDEX, "path": "embedding", "queryVector": qvec, "numCandidates": 100, "limit": 50}},
        {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
    ]
    if type:
        pipeline.append({"$match": {"type": type}})
    if not strict:
        # relevance threshold only for inferred/open queries, not explicit ones
        pipeline += [
            {"$setWindowFields": {"output": {"_top": {"$max": "$score"}}}},
            {"$match": {"$expr": {"$and": [
                {"$gte": ["$score", {"$subtract": ["$_top", SCORE_MARGIN]}]},
                {"$gte": ["$score", MIN_SCORE]},
            ]}}},
        ]
    pipeline.append({"$limit": FALLBACK_LIMIT})
    return await Event.aggregate(pipeline, projection_model=Event).to_list()


async def semantic_search(query: str, limit: int = 25, type: Optional[str] = None) -> list[Event]:
    if len(query.split()) <= 2:
        return await _text_search(query, limit, type)
    try:
        return await _vector_search(query, limit, type)
    except Exception:
        # Embedding/vector failure (e.g. Jina outage/quota) — degrade to
        # keyword search, which needs no embeddings, instead of erroring.
        return await _text_search(query, limit, type)
