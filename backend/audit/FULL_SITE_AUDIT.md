# EventLoop — Full Site Audit

**Date:** 2026-09-24
**Scope:** Every surface of the running app — backend + frontend + auth + data + UX + open items.
**Verdict:** 🟢 **Solid MVP.** The site works end-to-end: sign-in, browse, search, resume matching, event CRUD, teammates board, account deletion. Correctness gaps are closed. Remaining work is polish, small UX fixes, and ship prep.

---

## 1. Snapshot

**Stack**
- Backend: FastAPI (async), MongoDB Atlas via Beanie, Jina embeddings, PyJWT, slowapi, httpx.
- Frontend: React 19 + Vite 8 + MUI 9 + React Router 7 + TanStack Query 5 + Supabase JS + dayjs.
- Auth: Supabase email + password. JWT verified server-side via JWKS (asymmetric ES256).
- 34 backend Python files · 23 frontend JS/JSX files · ~4,993 lines counted across visible sources.

**Routes shipped**
- **Frontend:** `/` Discover · `/for-you` Resume matching · `/post` My posts + New event · `/teammates` Global teammate feed · `/events/:id` Event detail (with teammate panel).
- **Backend:** Events CRUD (list, search, get, POST, PATCH, DELETE, /mine), Match (POST /match/resume), Teammates (list, /event/:id, /mine, POST, DELETE), Account (DELETE /me), health/root.

---

## 2. What works well (keep as-is)

- **Editorial identity is consistent** — warm cream palette, Fraunces serif, the accent-italic phrasing pattern (*"worth showing up for."*, *"in the loop."*, *"people who fit."*) across every hero. Design tokens live in one place ([theme.js](../frontend/src/theme.js)) and are used everywhere.
- **Authoritative validation** — user-posted events go through `UserEventCreate` with strict length/date/URL rules; PATCH re-validates cross-field on the merged final state.
- **Dual JWT verification** — auth backend handles both legacy HS256 secret and asymmetric JWKS in one function.
- **Ownership guards** — DELETE / PATCH on events and teammate posts re-check `user_id` against the token before mutating. Never trust the URL param alone.
- **Rate limiting** — POST /events at 10/day/user via `slowapi`, keyed by Supabase user id.
- **Error boundary at the app root** catches render-time crashes and shows a clean recovery card instead of a white page.
- **Resume never stored** — profile is derived in-memory in `/match/resume`; only the distilled headline/skills/interests leave the function.
- **Optimistic delete** on My posts — card vanishes immediately, rolls back on error.
- **Denormalized teammate cards** — `TeammateInterest` snapshots event title/date/city so the global feed reads in one query.

---

## 3. Findings by area (with fixes)

Legend: 🔴 correctness/security · 🟡 UX / mid-severity · 🟢 polish

### 3.1 Discover ([DiscoverPage.jsx](../frontend/src/pages/DiscoverPage.jsx))

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | Search input state (`query`) is local to `DiscoverPage`. If you search "AI", click an event, then hit Back, the search is gone. | Persist `query` in the URL (`?q=AI`) via React Router. |
| 🟡 | Category filter only lists 5 of 7 event types (missing `communication` and `other`). Users hosting a communication event won't see a tab for it. | Add both to `CATS`. |
| 🟢 | `getEvents()` re-fetches the whole list every time you enter/exit the search view because we don't hydrate the search result into the main cache. | Fine for MVP scale, revisit at 1000+ events. |
| 🟢 | Skeleton loader is minimal (4 rows). Works, but doesn't visually match event row proportions on desktop. | Match the row's actual heights (60px avatar + 3 lines). |

### 3.2 Search / matching backend ([services/search.py](../backend/app/services/search.py))

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | Full-text search hits `["title", "tags"]` but not `description`. Users searching a phrase from the event body won't match unless the phrase is also in the title/tag. | Add `"description"` to the Atlas text index mapping AND to the `_text_search` path list. |
| 🟡 | `CATEGORY_KEYWORDS` doesn't include synonyms for `communication` or `other`. | Add them, or explicitly document why. |
| 🟢 | The vector-search fallback threshold (`MIN_SCORE=0.55`) is hardcoded per model. If you swap Jina → local `fastembed`, the score distribution shifts and this threshold no longer means the same thing. | Store per-model thresholds. |

### 3.3 Event detail ([EventDetailPage.jsx](../frontend/src/pages/EventDetailPage.jsx))

| Sev | Finding | Fix |
|---|---|---|
| 🔴 | `Register on {event.source}` renders `href={event.source_url \|\| undefined}`. If a native event has no source_url, the button becomes non-functional but still looks primary. | Hide the button, or replace with disabled state ("No registration link"). |
| 🟡 | "Hosted by" always says *"Aggregated from {source}"* — for a **native** event that reads oddly ("Aggregated from native"). Confusing for hosts of the site. | Show the host's name/email instead when `source === "native"`, and *"Aggregated from Devfolio"* etc. otherwise. |
| 🟡 | No "Edit" affordance for a native event you posted. To edit, you have to go back to `/post` → My posts → pencil icon. | Add a small "Edit" chip visible only to the owner. |
| 🟢 | Related events uses `getEvents()` and filters client-side — pulls the whole list to show 3 tiles. | Backend endpoint `/events?related_to=:id` (later). |
| 🟢 | "Add to calendar" button does nothing. | Generate an `.ics` file or a Google Calendar URL. |

### 3.4 For you ([ForYouPage.jsx](../frontend/src/pages/ForYouPage.jsx))

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | Only accepts PDFs. Docx / plain text bounce. | Add support for `.docx` (python-docx) and `.txt`, or say "PDF only" up-front in the drop zone. |
| 🟡 | Loading state is a single indeterminate bar. On a slow parse it feels stuck for 5+ seconds. | Add step feedback: "Reading PDF…", "Extracting profile…", "Matching events…". |
| 🟢 | Nothing prevents a user from uploading the same resume 10 times in a minute — it's stateless, but rate-limit the endpoint just in case. | `slowapi` on `/match/resume` (10/hour/IP is enough). |
| 🟢 | Groq's `stage` label can still be wrong on niche resumes. The frontend fix already hides `stage` from display, but the backend field is still surfaced in the API for anyone hitting `/match/resume` directly. | Not user-visible; leave for now. |

### 3.5 Post event ([PostEventPage.jsx](../frontend/src/pages/PostEventPage.jsx))

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | No draft persistence. Refresh mid-typing wipes the form. | `localStorage.setItem("post-draft", …)` on change, hydrate on mount, clear on publish. |
| 🟡 | Success card's "Post another event" resets the form but keeps you on the New event tab — this is fine, but there's no visible confirmation (toast) for a fraction of a second. | Add a small snackbar "Published — {title}". |
| 🟡 | Duplicate `useMemo` import (line 1) but only used inside `PreviewPanel`; harmless. | Cleanup. |
| 🟢 | Preview panel omits registration_deadline and end_date. Users can't check them visually. | Add them below the description. |
| 🟢 | Category chips lost their colored dots but the "active" pill background is `${color}15` (15 = 8% opacity), which is nearly invisible against cream. The border color still signals selection, but the background isn't doing work. | Bump to `${color}25` or drop the fill. |

### 3.6 Teammates ([TeammatesPage.jsx](../frontend/src/pages/TeammatesPage.jsx) + panel on EventDetailPage)

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | Teammates board is hackathon-only on the event page. But the global `/teammates` feed filter includes all categories, which means the feed can show categories that have no way to post. | Either enable the teammate panel on other event types, or filter the categories list on `/teammates` to only ones that can host teammate posts. |
| 🟡 | `user_name` is derived at post time as `email.split("@")[0]` — not their real name from `user_metadata.name`. | Read `user_metadata.name` from the JWT and use that when present. |
| 🟡 | Contact field is free-form. A malicious user could paste a scam link. Currently we sniff `http://` and email format, else render as plain text. | Add a soft warning: "Reach out at your own risk" line under contact links. |
| 🟢 | No pagination — 500 teammate posts loads all 500. | Not urgent; add `limit`/`offset` when the count gets there. |
| 🟢 | Deleting a teammate post has no confirm dialog. It's a low-consequence action, so probably fine, but inconsistent with delete-event flow. | Add a `window.confirm` fallback (or keep as-is if you want faster ops). |

### 3.7 Auth ([AuthDialog.jsx](../frontend/src/components/AuthDialog.jsx) + AuthProvider)

| Sev | Finding | Fix |
|---|---|---|
| 🔴 | Password field has `maxLength: 200` but no `minLength=6` enforced client-side on sign-up (it's checked in `submit()` only). | Add `helperText="At least 6 characters"` which we did — good. Consider adding a live check. |
| 🟡 | "Forgot password?" sends the reset link but there's no `/reset-password` route to handle the callback. Clicking the link from the email lands users at `/#access_token=…` and they see the home page. | Add a small `/reset-password` page that reads the token from the URL and lets the user enter a new password via `supabase.auth.updateUser({ password })`. |
| 🟡 | No email verification requirement. Anyone can sign up with `noone@example.com` and post events. | Turn "Confirm email" back on in Supabase before public launch. |
| 🟢 | On sign-out, header dropdown doesn't close until the next click. | Add explicit `setAnchor(null)` before awaiting signOut (already there). |

### 3.8 Account deletion ([account.py](../backend/app/routers/account.py))

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | If Supabase user delete fails after events are already deleted, the user's events are gone but their account remains. Rollback isn't possible. | Reverse the order: delete Supabase user first, then wipe events. If the auth call fails, events stay. |
| 🟡 | User's teammate posts aren't deleted alongside events. So a deleted user's pitch stays on `/teammates` orphaned. | Add `TeammateInterest.find(user_id=user.id).delete()` before Supabase delete. |
| 🟢 | Confirmation dialog says "your **rohanakode12@gmail.com** account and every event you've posted" — accurate but doesn't mention teammate posts. | Update copy once we cascade delete. |

### 3.9 Data model + backend ([models/event.py](../backend/app/models/event.py), [models/teammate.py](../backend/app/models/teammate.py))

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | `user_email` snapshot on Event goes stale if the user changes their email in Supabase. Same for TeammateInterest.`user_email`. | Either don't snapshot, or refresh via a scheduled job (once every 24h iterate and update). Or drop it and always join via user_id (needs a Users table). |
| 🟡 | Events posted by a user aren't deleted when their account is deleted — orphaned records. See 3.8. | Cascade delete. |
| 🟢 | `TeammateInterest.event_date` snapshots the event's start date, so if the event's date changes on PATCH, teammate cards show the old date. | On event PATCH, `TeammateInterest.find(event_id=…).set({event_date: …, event_title: …, event_city: …, event_online: …})`. |
| 🟢 | No indexes on `TeammateInterest.event_city` — filtering by city scans linearly. | Add compound index `(event_type, event_city)`. |

### 3.10 Security / production readiness

| Sev | Finding | Fix |
|---|---|---|
| 🔴 | **Real secrets are in `backend/.env`** (Mongo URI, Jina, Groq, Supabase JWT + service_role). File is `.gitignore`'d ✅, but rotating them before public launch is smart — anyone who cloned locally has them. | Rotate all 5 keys before deploy. |
| 🔴 | `CORSMiddleware` currently allows `settings.frontend_origin` only — will need to add the production domain before deploy. | Update `FRONTEND_ORIGIN` env in prod. |
| 🟡 | No rate limit on unauthenticated reads (`GET /events`, `GET /events/search`, `GET /teammates`). A single client could hammer semantic search and burn Jina quota. | Add `slowapi` at 60/min/IP on search endpoints. |
| 🟡 | `GET /events` returns every event ever stored (no pagination). At 1000+ events the payload becomes multi-MB. | Add `?skip=0&limit=50` with sensible defaults. |
| 🟡 | Backend `.env.example` mentions the service role key correctly but doesn't warn about the blast radius. | Add a comment: *"Full admin access to your Supabase project. Backend only. Rotate if leaked."* |
| 🟢 | `/health` returns config info (`env`). Fine for development; hide the env in prod if you want. | Leave. |

### 3.11 Frontend hygiene

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | Console spam: MUI 9 flags legacy props (`InputProps`, `InputLabelProps`, `PaperProps`, `flexWrap`, `alignItems`). Everything still works but console is noisy. | Migrate to `slotProps.input` / `slotProps.paper` etc. Purely mechanical; no behavior change. |
| 🟡 | React Query's default `staleTime: 60_000` means edits show up on other views only after 60s (or when you switch tabs). | For `["events"]` and `["events", "mine"]`, invalidate on mutations (already done). Fine as-is. |
| 🟢 | `main.jsx` wraps in `React.StrictMode` in dev — some intentional double-renders may hide subtle bugs. That's the point of StrictMode, but be aware. | Keep. |
| 🟢 | No global 404 route. Typing `/foo` renders nothing (routes just don't match). | Add `<Route path="*" element={<NotFound />} />`. |
| 🟢 | Empty state on `/teammates` says "Head to a hackathon or event page" — but only hackathon pages have the teammate panel. | Reword: *"Open a hackathon and be the first to say you're looking."* |

### 3.12 UX gaps that affect trust

| Sev | Finding | Fix |
|---|---|---|
| 🟡 | Posting a native event puts it in the same feed as scraped events with no differentiation. Users can't tell "this was hosted by a community member" vs "this is from Devfolio". | Small "Native" badge on native event cards. |
| 🟡 | No "share this event" affordance on the event detail page. | Add a share button (Web Share API on mobile, copy-link on desktop). |
| 🟢 | The Header logo doesn't visually indicate current page. Nav labels do, but the O-ring logo is inert. | Fine. |
| 🟢 | No dark mode. Editorial cream palette is fixed. | Not urgent; a real dark mode is a design project of its own. |

---

## 4. Deploy readiness checklist

- [ ] Rotate all secrets (Mongo, Jina, Groq, Supabase JWT + service_role).
- [ ] Set `FRONTEND_ORIGIN` in backend prod env to the deployed URL.
- [ ] Enable Supabase email confirmation.
- [ ] Add `/reset-password` route for the forgot-password callback.
- [ ] Add pagination on `GET /events` and `GET /teammates`.
- [ ] Rate-limit unauthenticated reads.
- [ ] Delete-account cascade: also wipe TeammateInterest rows.
- [ ] MUI legacy props migration (kill console warnings).
- [ ] 404 route.
- [ ] Consistent "Native" badge on user-posted events.
- [ ] Update the Atlas Search index mapping to include `description`.

---

## 5. Prioritized order to actually do

**Correctness first (do before any user sees the site):**
1. Cascade-delete TeammateInterest on account delete (3.8).
2. Native events without source_url shouldn't render a "Register" button (3.3).
3. Native events "Hosted by" copy fix (3.3).
4. Update Atlas index to include `description` for text search (3.2).
5. Pagination on `GET /events` (3.10).

**Trust + polish (before external users):**
6. Save form draft to localStorage (3.5).
7. `/reset-password` callback route (3.7).
8. "Edit" button on the event detail page for owners (3.3).
9. Real name on teammate posts, from `user_metadata.name` (3.6).
10. Native event badge on Discover cards (3.12).

**Hygiene:**
11. Migrate MUI legacy props (3.11).
12. 404 route (3.11).
13. Rate-limit search + resume endpoints (3.4, 3.10).

**Deploy:**
14. Rotate secrets · set prod CORS · enable email confirmation · deploy.

---

## 6. Verdict

The site now does everything a first-time visitor expects: find events, get personalized matches, host their own, find teammates. Nothing on the critical path is broken, and no one thing on this list is scary. Section 5's first block (correctness) is about **half a day of work**. After that you can ship to strangers with a clear conscience.

The two biggest remaining weaknesses are both about **trust for external users**, not correctness:
1. Native events don't visually distinguish themselves from scraped ones.
2. There's no email confirmation on signup, so anyone can post as a fake identity.

Both are one-line configuration/copy fixes; neither needs new architecture. The heavy lifting is done.
