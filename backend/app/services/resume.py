"""Resume text extraction + skills/goals extraction via Groq.

Kept small and self-contained: no storage — the resume is processed in-memory
and only the distilled profile leaves this function.
"""
from __future__ import annotations

import io
import json
import re
from typing import Optional

import pdfplumber
from groq import Groq

from app.config import settings

GROQ_MODEL = "openai/gpt-oss-120b"

_client: Optional[Groq] = None


def _groq() -> Optional[Groq]:
    global _client
    if _client is None and settings.groq_api_key:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def extract_text(pdf_bytes: bytes) -> str:
    """Pull raw text from a PDF resume."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t:
                text_parts.append(t)
    text = "\n".join(text_parts)
    return re.sub(r"[ \t]+", " ", text).strip()


def extract_profile(resume_text: str) -> dict:
    """Use Groq to distill the resume into a structured, matchable profile.

    Returns { headline, skills[], interests[], stage, goal }.
    Falls back to a heuristic if Groq is unavailable.
    """
    client = _groq()
    if not client or not resume_text.strip():
        return _heuristic_profile(resume_text)

    prompt = (
        "Extract a short professional profile from this resume as JSON with keys: "
        "headline (one-line role summary, max 12 words), "
        "skills (5-10 concrete technical skills/tools), "
        "interests (3-6 broader interest areas, e.g. 'GenAI', 'startups', 'web dev'), "
        "stage (one of: student, fresher, junior, mid, senior), "
        "goal (one short line — what they're likely looking for next). "
        "Return ONLY the JSON object, no prose.\n\n"
        f"Resume:\n{resume_text[:6000]}"
    )
    try:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(resp.choices[0].message.content)
        # Normalize
        return {
            "headline": str(data.get("headline", "")).strip(),
            "skills": [str(s).strip() for s in (data.get("skills") or []) if str(s).strip()][:10],
            "interests": [str(s).strip() for s in (data.get("interests") or []) if str(s).strip()][:6],
            "stage": str(data.get("stage", "")).strip().lower() or "unknown",
            "goal": str(data.get("goal", "")).strip(),
        }
    except Exception:
        return _heuristic_profile(resume_text)


def _heuristic_profile(text: str) -> dict:
    """Fallback profile when Groq is unavailable — very basic keyword pass."""
    known = [
        "python", "javascript", "typescript", "react", "node", "next", "django",
        "flask", "fastapi", "express", "mongodb", "postgres", "sql", "aws", "docker",
        "kubernetes", "genai", "llm", "ai", "ml", "pytorch", "tensorflow", "html",
        "css", "git", "java", "c++", "go", "kotlin", "swift",
    ]
    t = text.lower()
    skills = [k for k in known if k in t][:10]
    return {
        "headline": "Developer" if skills else "Professional",
        "skills": skills,
        "interests": [],
        "stage": "unknown",
        "goal": "",
    }


def build_query(profile: dict, intent: str | None) -> str:
    """Turn the profile + user's stated intent into one string to embed.

    Intent is emphasized (repeated) because it's what the user *wants now*,
    but the profile still contributes so ranking reflects fit.
    """
    parts = []
    intent_clean = (intent or "").strip()
    if intent_clean:
        # Emphasize the intent so it shapes ranking, but keep profile signal too.
        parts.append(intent_clean)
        parts.append(intent_clean)
    if profile.get("headline"):
        parts.append(profile["headline"])
    if profile.get("skills"):
        parts.append("Skills: " + ", ".join(profile["skills"]))
    if profile.get("interests"):
        parts.append("Interests: " + ", ".join(profile["interests"]))
    if profile.get("goal"):
        parts.append("Goal: " + profile["goal"])
    return ". ".join(parts) or "career growth event"


def why_matches(event_text: str, event_type: str, profile: dict, intent: str | None) -> str:
    """Human-readable reason an event fits.

    - If the event mentions any of your skills/interests → name them.
    - Otherwise, when we have a resume profile, still surface WHY this fits
      YOU (e.g. "A hackathon — great for a Full-Stack + AI developer").
    - Only fall back to a plain category line if we have no profile at all.
    """
    text = event_text.lower()

    def _match_terms(terms: list[str]) -> list[str]:
        hits: list[str] = []
        for term in terms:
            words = [w for w in re.split(r"[^a-z0-9]+", term.lower()) if len(w) > 2]
            if any(w in text for w in words) and term not in hits:
                hits.append(term)
            if len(hits) >= 3:
                break
        return hits

    hits = _match_terms(profile.get("skills") or [])
    if len(hits) < 2:
        hits.extend(_match_terms(profile.get("interests") or []))
        hits = hits[:3]
    if hits:
        return "Matches your " + ", ".join(hits)

    # No direct term overlap — surface a profile-aware reason if we can.
    headline = (profile.get("headline") or "").strip()
    interests = profile.get("interests") or []
    skills = profile.get("skills") or []

    if headline:
        return f"A {event_type} for a {headline.lower()}"
    if interests:
        return f"Fits your interests in {', '.join(interests[:2])}"
    if skills:
        return f"Fits your {event_type} interest — matches your {', '.join(skills[:2])} background"
    if intent and intent.strip():
        return f"Fits your {event_type} interest"
    return "Relevant to your background"
