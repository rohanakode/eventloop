"""Resume text extraction + skills/goals extraction via Groq.

Kept small and self-contained: no storage — the resume is processed in-memory
and only the distilled profile leaves this function.
"""
from __future__ import annotations

import io
import json
import re
from datetime import date
from typing import Optional

import pdfplumber
from groq import Groq

from app.config import settings

GROQ_MODEL = "openai/gpt-oss-120b"

# Stages we accept — ordered from least to most experience. Anything else is
# normalized down to the closest match (or "professional" as a safe default).
VALID_STAGES = {"student", "intern", "fresher", "junior", "mid", "senior", "professional"}

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

    today = date.today().isoformat()
    prompt = (
        "You extract a structured profile from a resume for an event-matching site "
        "(hackathons, meetups, workshops, conferences). The site serves anyone "
        "interested in tech events — students, interns, freshers, and working "
        f"professionals alike. Today's date is {today}.\n\n"
        "Read the ENTIRE resume before deciding the stage. Look at graduation "
        "dates, internship/job date ranges, and titles. A person who has already "
        "graduated or already completed internships is NOT a student anymore, "
        "even if their degree section is prominent.\n\n"
        "Return JSON with these keys:\n"
        "- headline: one-line role summary, max 12 words. Reflect their ACTUAL "
        "  strongest identity (e.g. 'Full-Stack AI Engineer with Cloud & MERN "
        "  expertise'), not just their degree.\n"
        "- skills: 5-10 concrete technical skills/tools they've actually used.\n"
        "- interests: 3-6 broader interest areas (e.g. 'GenAI', 'startups', 'web dev').\n"
        "- stage: pick EXACTLY ONE, based on real experience relative to today:\n"
        "    * 'student'      — currently enrolled, no internship or job experience yet.\n"
        "    * 'intern'       — currently in an internship, or only internship experience so far.\n"
        "    * 'fresher'      — graduated within the last ~12 months and looking for their first full-time role,\n"
        "                        OR has finished internships but not yet started a full-time role.\n"
        "    * 'junior'       — 0-2 years of full-time professional experience.\n"
        "    * 'mid'          — 3-6 years of full-time professional experience.\n"
        "    * 'senior'       — 7+ years, or clear leadership/staff/principal titles.\n"
        "    * 'professional' — clearly working in industry but seniority is unclear.\n"
        "  Do the date math against today's date. If graduation year is <= this year and they have finished internships, they are NOT a student.\n"
        "- goal: one short line — what they're likely looking for next.\n\n"
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
        stage = str(data.get("stage", "")).strip().lower() or "unknown"
        if stage not in VALID_STAGES and stage != "unknown":
            stage = "professional"
        # Cross-check against the resume text itself so an over-eager "student" label
        # gets corrected when the resume clearly shows completed experience.
        stage = _reconcile_stage(stage, resume_text)
        return {
            "headline": str(data.get("headline", "")).strip(),
            "skills": [str(s).strip() for s in (data.get("skills") or []) if str(s).strip()][:10],
            "interests": [str(s).strip() for s in (data.get("interests") or []) if str(s).strip()][:6],
            "stage": stage,
            "goal": str(data.get("goal", "")).strip(),
        }
    except Exception:
        return _heuristic_profile(resume_text)


def _reconcile_stage(stage: str, resume_text: str) -> str:
    """Guard against an over-eager 'student' label when the resume actually shows
    completed work. We only DOWNGRADE the studenthood — we never override a
    higher label the LLM already picked."""
    if stage not in {"student", "unknown", ""}:
        return stage

    t = resume_text.lower()
    today_year = date.today().year

    # Any year <= today's year appearing in a work/internship-style date range.
    # E.g. "Mar 2026 – Jun 2026", "2024 - Present". We look for a 4-digit year
    # up to the current year, plus a nearby range separator.
    range_years = re.findall(r"\b(20\d{2})\s*[-–—]\s*(20\d{2}|present|current|now)\b", t)
    finished_ranges = []
    for start, end in range_years:
        end_year = today_year if end in {"present", "current", "now"} else int(end)
        if end_year <= today_year:
            finished_ranges.append((int(start), end_year))

    has_internship = "intern" in t or "internship" in t
    has_fulltime = any(kw in t for kw in [
        "software engineer", "software developer", "senior engineer",
        "full-time", "full time", "engineering manager", "tech lead",
        "principal", "staff engineer",
    ])

    # If they have finished date ranges AND internship/job wording, they're not a student.
    if finished_ranges and (has_internship or has_fulltime):
        if has_fulltime:
            return "junior"
        return "fresher" if any(end >= today_year - 1 for _, end in finished_ranges) else "intern"

    return stage or "unknown"


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
    # Reuse the same reconciliation logic so the heuristic doesn't mislabel a
    # graduated intern as a student either.
    stage = _reconcile_stage("student" if "student" in t else "unknown", text)
    return {
        "headline": "Developer" if skills else "Professional",
        "skills": skills,
        "interests": [],
        "stage": stage,
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
