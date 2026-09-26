"""Ingestion pipeline: fetch -> filter -> dedup -> store, and expire old events.

Run directly:  python -m app.pipeline.ingest
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timezone

from app.database import init_db, close_db
from app.models.event import Event
from app.pipeline.filters import passes
from app.schemas.event import EventBase
from app.services.embeddings import embed_texts
from app.sources.registry import get_sources

PER_SOURCE_CAP = 30
TOTAL_CAP = 250


def _dedup_key(base: EventBase) -> str:
    """Stable key so the same event isn't stored twice across runs."""
    if base.source_url:
        return base.source_url.rstrip("/").lower()
    return f"{base.source}:{base.title.strip().lower()}:{base.date.isoformat()}"


async def delete_expired(today: date) -> int:
    """Remove events whose event date OR registration deadline has passed."""
    cutoff = datetime.combine(today, time.min)
    result = await Event.find(
        {"$or": [
            {"date": {"$lt": cutoff}},
            {"registration_deadline": {"$lt": cutoff}},
        ]}
    ).delete()
    return result.deleted_count if result else 0


async def _upsert(base: EventBase, embedding: list[float]) -> bool:
    """Insert a new event or update an existing one. Returns True if newly inserted."""
    key = _dedup_key(base)
    doc = Event.from_base(base, key)
    doc.embedding = embedding
    existing = await Event.find_one(Event.dedup_key == key)
    if existing:
        data = doc.model_dump(exclude={"id", "created_at"})
        data["updated_at"] = datetime.now(timezone.utc)
        await existing.set(data)
        return False
    await doc.insert()
    return True


async def _remove_unseen(source_name: str, seen_keys: set[str]) -> int:
    """Delete events from a source that it no longer lists (cancelled/removed).

    Only called for sources that fetched successfully. Never touches other
    sources or native (user-posted) events.
    """
    removed = 0
    existing = await Event.find(Event.source == source_name).to_list()
    for event in existing:
        if event.dedup_key not in seen_keys:
            await event.delete()
            removed += 1
    return removed


async def run_ingestion() -> dict:
    today = date.today()
    expired = await delete_expired(today)

    # 1. Fetch + filter per source. Track which keys each source currently lists.
    collected: dict[str, EventBase] = {}
    per_source: dict[str, dict] = {}
    seen_by_source: dict[str, set[str]] = {}
    for source in get_sources():
        try:
            fetched = source.fetch()
        except Exception as exc:  # a broken source must not kill the run
            per_source[source.name] = {"error": str(exc)[:120]}
            continue  # NOT marked as seen -> its cleanup is skipped (safety rule #1)

        passed = [e for e in fetched if passes(e, today)]
        seen_by_source[source.name] = {_dedup_key(e) for e in passed}
        kept = passed[:PER_SOURCE_CAP]
        per_source[source.name] = {"fetched": len(fetched), "kept": len(kept)}
        for base in kept:
            collected.setdefault(_dedup_key(base), base)  # dedup within batch

    # 2. Apply total cap, embed the batch, then upsert.
    # Include type + tags in the embedded text so category-style queries
    # (e.g. "coding competition") rank the right events higher.
    batch = list(collected.values())[:TOTAL_CAP]
    texts = [
        f"{b.title}. Category: {b.type}. {b.description} Topics: {', '.join(b.tags)}"
        for b in batch
    ]
    vectors = embed_texts(texts) if batch else []
    inserted = updated = 0
    for base, vector in zip(batch, vectors):
        if await _upsert(base, vector):
            inserted += 1
        else:
            updated += 1

    # 3. Remove events a (successful) source no longer lists - per source only.
    removed_stale = 0
    for source_name, seen in seen_by_source.items():
        removed_stale += await _remove_unseen(source_name, seen)

    total = await Event.count()
    return {
        "expired_removed": expired,
        "per_source": per_source,
        "inserted": inserted,
        "updated": updated,
        "removed_stale": removed_stale,
        "total_in_db": total,
    }


async def _main() -> None:
    await init_db()
    try:
        stats = await run_ingestion()
        print("Ingestion complete:")
        for k, v in stats.items():
            print(f"  {k}: {v}")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(_main())
