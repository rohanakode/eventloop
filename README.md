<div align="center">

# EventLoop

### Career events, without the doomscroll.

Hackathons, startup meetups, workshops, conferences and networking events for Hyderabad and online, pulled from the places builders already check and surfaced in one clean feed. Upload a resume once and get a ranked shortlist of events that actually fit you.

<p>
  <img alt="React" src="https://img.shields.io/badge/React-19-black?logo=react&logoColor=61DAFB" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-black?logo=vite&logoColor=FFCE00" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-async-black?logo=fastapi" />
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Atlas-black?logo=mongodb" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Auth-black?logo=supabase" />
</p>

</div>

<br />

> This repository holds both the frontend (React + Vite) and the backend (FastAPI + MongoDB + the event ingestion pipeline).

<br />

## Overview

EventLoop aggregates career events from Devfolio, Unstop, Meetup and T-Hub, deduplicates them across sources, and serves a single feed. Signed-in users can post their own events, edit them, and use the teammate board on any hackathon to find people to build with. The "For you" page turns a PDF resume plus a short intent line into a ranked list of events grouped by category, using vector search over event embeddings.

Browsing is open to everyone. Signing in is only needed to post an event, use the teammate board, or run resume matching.

<br />

## Features

- Discover feed with category filters and hybrid keyword and semantic search
- Resume based ranking, per category, with a short "why this matched" note on each result
- Post an event in a minute, edit or unpublish it any time
- Teammate board for every hackathon, with a global feed of everyone currently looking
- Rate limited posting, JWT verified requests, idempotent ingestion

<br />

## Stack

**Frontend**
- React 19, Vite 8, MUI 9
- React Router 7, TanStack Query 5
- Supabase JS, dayjs

**Backend**
- FastAPI (async), MongoDB Atlas via Beanie
- Jina embeddings (jina-embeddings-v3, 1024 dim) with a local fastembed fallback
- Groq for resume profile extraction
- Atlas Vector Search plus full text Search
- PyJWT, slowapi

**Sources**
- Devfolio, Unstop, Meetup, T-Hub. Adding one is a single file in `backend/app/sources/<name>/scraper.py` plus one line in `registry.py`.

<br />

## Project layout

```
eventloop/
  backend/
    app/
      main.py            FastAPI entry, CORS, error handlers
      config.py          settings from .env
      database.py        Mongo and Beanie init
      models/            Beanie ODM docs
      schemas/           Pydantic request and response shapes
      routers/           events, match, teammates, account
      services/          embeddings, hybrid search, resume parsing
      pipeline/          scrape, filter, dedupe, embed, store
      sources/           per-site scrapers
      utils/             auth, dates, html to md, rate limit
  frontend/
    src/
      App.jsx            routes
      pages/             DiscoverPage, ForYouPage, PostEventPage, ...
      components/        Header, EventRow, TeammateCard, AuthDialog, ...
      api/               thin axios wrappers per resource
      lib/               AuthProvider, Toast, supabase client
      theme.js           design tokens
```

<br />

## Getting started

### Prerequisites

- Node 20 or later
- Python 3.12
- A MongoDB Atlas cluster with a Vector Search index named `vector_index` on `events.embedding` (1024 dims, cosine)
- A Supabase project
- Optional: a Jina API key (local fastembed is used as fallback), a Groq API key (required for the resume flow on "For you")

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

The API runs on `http://localhost:8000`. The Swagger UI is at `/docs`.

Required environment variables in `backend/.env`:

| Key | Purpose |
|-----|---------|
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DB` | Database name, defaults to `eventloop` |
| `SUPABASE_URL` | Your project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key from Supabase, backend only |
| `FRONTEND_ORIGIN` | Origin allowed by CORS, `http://localhost:5173` in dev |
| `JINA_API_KEY` | Optional, skips local embedding when set |
| `GROQ_API_KEY` | Needed for `/for-you` resume parsing |
| `SUPABASE_JWT_SECRET` | Only if your project still uses legacy HS256 tokens |

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

The app runs on `http://localhost:5173`.

Required environment variables in `frontend/.env`:

| Key | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL` | Same URL as the backend |
| `VITE_SUPABASE_ANON_KEY` | Publishable key from Supabase |

### Seed the feed

The database starts empty. Run the ingestion pipeline once to scrape every source, filter, dedupe, embed and upsert:

```bash
cd backend
python -m app.pipeline.ingest
```

The command is safe to re-run. It also expires events whose date has already passed.

<br />

## Key endpoints

Base URL `http://localhost:8000`. Full schema at `/docs`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | List, filterable by `type`, `online`, `city` |
| GET | `/events/search?q=...` | Hybrid keyword and semantic search |
| GET | `/events/{id}` | One event |
| POST | `/events` | Publish (auth) |
| PATCH | `/events/{id}` | Edit your own (auth) |
| DELETE | `/events/{id}` | Unpublish your own (auth) |
| GET | `/events/mine` | Your posts (auth) |
| POST | `/match/resume` | Multipart: `resume` (PDF) and `intent`. Returns ranked matches. |
| GET | `/teammates` | Global teammate feed |
| GET | `/teammates/event/{id}` | Board for one event |
| POST | `/teammates` | Post yourself as looking (auth) |
| DELETE | `/teammates/{id}` | Withdraw (auth) |
| DELETE | `/account/me` | Hard delete your account and every post you made (auth) |

<br />

## How the "For you" match works

1. The PDF is validated (magic bytes, size cap 5 MB) and read in memory. It is never stored.
2. Text is extracted with pdfplumber.
3. Groq turns the text into a compact profile (headline, skills, interests, career stage, goal) and confirms that the file is actually a resume, not an invoice or a marksheet.
4. If the intent names a category such as "hackathon", the search is restricted to that category so the resume's skill vector does not drown out the intent.
5. Query text (profile plus intent) is embedded with Jina and passed to Mongo Vector Search over `events.embedding`.
6. Results are grouped by category, up to four per category, plus a flat top N.
7. A short "why this matched" line is generated per result.

<br />

## Adding a new event source

1. Create `backend/app/sources/<name>/scraper.py` implementing `EventSource` from `sources/base.py`. It needs one method: `async fetch(self) -> list[EventBase]`.
2. Register it in `backend/app/sources/registry.py`.
3. Run `python -m app.pipeline.ingest`. Filtering (career only, Hyderabad or online, still upcoming), deduplication, embedding and storage all happen automatically.

<br />

## Frontend scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

<br />

## Notes

- Events are filtered to career relevant, Hyderabad or online, and still upcoming. The filter lives in `backend/app/pipeline/filters.py`.
- Cross source duplicates (the same hackathon on Devfolio and Unstop) are collapsed by fuzzy title matching within the same calendar day. See `backend/app/pipeline/deduplication.py`.
- Posting is rate limited per user via slowapi.
- The teammate board is hackathon focused. The global feed shows every open board across every event.

<br />

## License

Not published yet. Please ask before reusing.
