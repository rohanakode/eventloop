# EventLoop — Backend Audit

**Date:** 2026-09-22
**Scope:** Full audit of the `backend/` service (FastAPI + MongoDB Atlas + hybrid search)
**Verdict:** ✅ Healthy. Core is clean, modular, and data integrity is perfect. Known gaps are expected (auth, scheduling, deploy) and listed below.

---

## 1. Overview

EventLoop's backend aggregates career events (Hyderabad + online) from external sources into MongoDB Atlas, and serves them through a FastAPI API with hybrid (keyword + semantic) search.

- **Language/Framework:** Python 3.12, FastAPI (async)
- **Database:** MongoDB Atlas (Beanie ODM over Motor)
- **Search:** Atlas Vector Search + Atlas full-text Search
- **Embeddings:** Jina API (`jina-embeddings-v3`, 1024-dim) with local `fastembed` fallback
- **Total code:** ~972 lines across 27 Python files

---

## 2. Architecture & structure

```
app/
├── main.py              # FastAPI app, CORS, lifespan (DB connect/close)
├── config.py            # Settings from .env (pydantic-settings)
├── database.py          # Motor client + Beanie init
├── models/event.py      # Event DB document (Beanie) + indexes
├── schemas/event.py     # EventBase / EventOut (Pydantic API shapes)
├── routers/events.py    # GET /events, /events/search, /events/{id}
├── services/
│   ├── embeddings.py    # Jina API + fastembed fallback
│   └── search.py        # hybrid + category-aware search
├── sources/
│   ├── base.py          # EventSource contract (ABC)
│   ├── registry.py      # active source list
│   ├── devfolio/scraper.py
│   └── meetup/scraper.py
├── pipeline/
│   ├── ingest.py        # fetch → filter → dedup → embed → upsert → cleanup
│   └── filters.py       # career-only, Hyderabad/online, active
├── utils/dates.py       # IST timezone date handling
└── data/seed_events.py  # ⚠️ leftover, unused (see issues)
```

**Assessment:** Clean separation of concerns. The `EventSource` contract makes adding sources isolated and low-risk. Single-responsibility modules throughout. ✅

---

## 3. Dependencies (requirements.txt)

| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.115.6 | Web framework |
| uvicorn[standard] | 0.34.0 | ASGI server |
| pydantic / pydantic-settings | 2.10.4 / 2.7.1 | Validation, settings |
| motor / beanie | 3.6.0 / 1.29.0 | Async MongoDB + ODM |
| httpx | 0.28.1 | HTTP (scrapers + Jina) |
| fastembed | 0.5.1 | Local embedding fallback |
| tzdata | 2025.2 | Windows timezone data (IST) |
| python-dotenv | 1.0.1 | .env loading |

All pinned to explicit versions. ✅ No known-vulnerable packages identified.

---

## 4. Component review

### config.py ✅
Loads all settings from `.env` via `pydantic-settings`. Secrets (Mongo URI, Jina/Groq keys, Supabase) never hardcoded. `extra="ignore"` set.

### database.py ✅
Async Motor client + `init_beanie` with the `Event` model. Clean connect/close, wired to app lifespan in `main.py`.

### models/event.py ✅
`Event` Beanie document. Dates stored as `datetime` (BSON has no `date`). Indexes: **unique `dedup_key`**, `date`, `type`. `from_base()` maps normalized `EventBase` → document. `embedding: Optional[list[float]]`.

### schemas/event.py ✅
`EventBase` (source/normalized shape) and `EventOut` (API response). `EventType` is a constrained `Literal`. Fields: title, description, type, date, end_date, registration_deadline, city, online, source, source_url, tags.

### services/embeddings.py ✅ (1 risk)
Jina API when `JINA_API_KEY` set, else local `fastembed`. Asymmetric tasks (`retrieval.passage` for docs, `retrieval.query` for queries). **Risk:** `EMBED_DIM` differs (1024 Jina vs 384 fastembed) — see Issue #5.

### services/search.py ✅
Hybrid, category-aware:
- Short (≤2 words) → fuzzy full-text (`text_index`)
- Longer → semantic vector search, with category detection (explicit keyword OR embedding similarity) to keep category-intent clean
- Relevance threshold (relative margin + floor) for open queries only

### sources/ ✅
`base.EventSource` ABC; `devfolio` (parses Next.js `__NEXT_DATA__`), `meetup` (parses Apollo state, verifies real venue city, strips Markdown). Each fetch+normalize only; filtering/dedup happen in the pipeline.

### pipeline/ ✅
`ingest.run_ingestion()`: expire → fetch per source (isolated try/except) → filter → per-source cap (30) → dedup → total cap (250) → batch embed → upsert → per-source stale cleanup. `filters.passes()` = career-only ∧ (Hyderabad ∨ online) ∧ active.

### utils/dates.py ✅
`iso_to_ist_date()` converts source timestamps to India time before taking the calendar date (fixes UTC off-by-one).

---

## 5. API endpoints

| Method | Path | Behavior | Status |
|---|---|---|---|
| GET | `/health` | Liveness | ✅ |
| GET | `/` | Info message | ✅ |
| GET | `/events` | List + filters (`type`, `online`, `city`) | ✅ |
| GET | `/events/search` | Hybrid search (`q`, optional `type`) | ✅ |
| GET | `/events/{id}` | Event detail; 400 on bad id, 404 if missing | ✅ |

Route order is correct (`/search` before `/{id}`). CORS restricted to `FRONTEND_ORIGIN`.

---

## 6. Data pipeline lifecycle

```
1. delete_expired      remove events where date OR registration_deadline < today
2. per source:         fetch() → filter (career/Hyd-or-online/active) → cap 30
                       (a failed source is skipped, NOT cleaned up — safety)
3. dedup within batch   by dedup_key (source_url based)
4. total cap 250
5. batch embed          title + category + description + tags → Jina vectors
6. upsert               update existing (by dedup_key) or insert — reflects source edits, no dupes
7. stale cleanup        per successful source, remove events it no longer lists
                        (never touches other sources or native events)
```

**Assessment:** Idempotent, self-healing, safe against source outages. ✅

---

## 7. Search system

- **Keyword/category (short):** fuzzy full-text on title/tags/type (typo-tolerant, e.g. "hackthon" → hackathons).
- **Category-aware (phrases):** detects category via explicit keywords or embedding similarity; explicit category → returns all of that category; inferred → filtered + thresholded.
- **Semantic (open):** vector similarity, relative threshold, capped to 6 best matches.
- **Thresholds:** `SCORE_MARGIN=0.05`, `MIN_SCORE=0.55`, `FALLBACK_LIMIT=6` — tuned for Jina v3 + current dataset.

**Note:** thresholds are heuristic and dataset-dependent; revisit as event volume grows.

---

## 8. Data integrity audit (verified 2026-09-22)

| Check | Result |
|---|---|
| Total events | 22 |
| By source | devfolio: 2, meetup: 20 |
| By type | hackathon: 2, networking: 18, conference: 1, startup: 1 |
| Missing embeddings | **0** ✅ |
| Embedding dimensions | **{1024}** (consistent) ✅ |
| Invalid event types | **0** ✅ |
| Not Hyderabad/online | **0** ✅ |
| Expired (date < today) | **0** ✅ |
| Duplicate dedup_keys | **0** ✅ |
| Missing title/desc/url | **0** ✅ |
| Search indexes | text_index (READY), vector_index (READY) ✅ |
| DB indexes | _id, **dedup_key (unique)**, date, type ✅ |

**Perfect data integrity.** ✅

---

## 9. Security review

| Area | Status | Note |
|---|---|---|
| Secrets in .env, git-ignored | ✅ | `.env` never committed |
| Hardcoded secrets in code | ✅ None | All via settings |
| Input validation | ✅ | Pydantic + typed query params; bad id → 400 |
| CORS | 🟡 | Locked to `FRONTEND_ORIGIN`; add prod origin at deploy |
| Authentication | ⚠️ None yet | API is public read-only (acceptable now; Supabase auth planned) |
| Rate limiting | ⚠️ None | No abuse protection on `/events/search` (drives Jina usage) |
| DB credentials | ⚠️ | Password appeared in a screenshot earlier — **rotate it** |
| Injection | ✅ | No raw string queries; ODM + parameterized |

---

## 10. Error handling & resilience

- ✅ One broken source doesn't kill ingestion (per-source try/except) and its data isn't wrongly deleted.
- ✅ `get_event` handles invalid/missing ids (400/404).
- 🟡 `/events/search` has no try/except around the Jina call — if Jina errors (quota/outage) it returns 500 (no fallback when the key is *present* but failing). See Issue #6.
- ✅ Managed Atlas handles DB availability/backups.

---

## 11. Performance & scalability

- ✅ Fully async (Motor/Beanie); non-blocking I/O.
- ✅ Bulk embedding done in batch; heavy embedding intended for GitHub Actions (off web server).
- 🟡 `/events` returns all events (no pagination) — fine at ≤250; add pagination before large scale.
- ✅ Vector `numCandidates=100` is ample for current size.
- 🟡 Category vectors + fastembed model load lazily (first-request latency); acceptable.

---

## 12. Known issues / risks (prioritized)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | 🔴 High | **Rotate the MongoDB password** (exposed in a screenshot) | Atlas → Database Users → edit password → update `.env` |
| 2 | 🟠 Med | **No auth** on the API | Add Supabase auth before write endpoints (post event) |
| 3 | 🟠 Med | **No rate limiting** on search | Add slowapi / limit per IP before deploy |
| 4 | 🟠 Med | **Ingestion not scheduled** | Add GitHub Actions cron |
| 5 | 🟠 Med | **Embedding dim mismatch on fallback** — removing `JINA_API_KEY` switches to 384-dim fastembed, but the vector index is 1024-dim → vector search breaks | Keep dims aligned; rebuild index if the model changes |
| 6 | 🟡 Low | **Search 500 on Jina failure** (no fallback when key present but errors) | Wrap Jina call; fall back to fastembed on error |
| 7 | 🟡 Low | **Scrapers are structure-dependent** (Next.js/Apollo) — break if sites change | Standard scraping risk; monitor, isolate per source (already isolated) |
| 8 | 🟡 Low | **Dead code**: `app/data/seed_events.py` unused | Delete |
| 9 | 🟡 Low | **CORS single origin** | Add production frontend origin at deploy |
| 10 | 🟡 Low | **No automated tests** | Add pytest for filters, dedup, search routing |
| 11 | 🟡 Low | **Search thresholds are dataset-tuned** | Revisit as event volume grows |

---

## 13. Recommendations (next steps)

1. **Rotate the DB password** (do this now).
2. Delete `app/data/seed_events.py` (dead code).
3. Wrap the Jina call with a fastembed fallback on error (Issue #6).
4. Add GitHub Actions scheduled ingestion.
5. Add auth (Supabase) + rate limiting before exposing write endpoints / deploying publicly.
6. Add a small pytest suite (filters, dedup key, date IST, search routing).
7. Add pagination to `/events` before scaling past a few hundred events.

---

## 14. Verification summary

- **API smoke test:** 4/4 passed (health, detail, keyword search precision, semantic top-result).
- **Filters:** type / online / city all return correct subsets.
- **Data integrity:** 0 issues across 10 checks.
- **Indexes:** all present and READY.

**Overall: the backend is solid and production-*capable* for a portfolio project, pending the High/Med items above (auth, rate limiting, scheduling, password rotation).**
