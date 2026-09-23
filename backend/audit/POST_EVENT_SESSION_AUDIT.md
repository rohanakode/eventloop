# EventLoop — Post Event Section Audit

**Date:** 2026-09-23
**Scope:** The entire "Post event" flow — auth gate, sign-in/sign-up dialog, My posted events list, New event form, and the backend endpoints that back them.
**Verdict:** 🟡 **Functional end-to-end but not production-ready.** The core loop works: a signed-in user can publish, see their posts, and delete them. Sign-in gate is enforced, JWT verification is correct, and event ownership is respected. Gaps are in server-side validation, error affordances, UX polish, and lifecycle features (edit, drafts, unpublish-vs-delete).

---

## 1. Overview

The Post Event section is the first authenticated surface in EventLoop. It lets a signed-in user publish an event, see the events they've hosted, and delete their own. Everything else in the app (Discover, For you, event detail) is read-only.

**Files in scope:**

| Layer | File | Role |
|---|---|---|
| Backend | `app/routers/events.py` | `POST /events`, `GET /events/mine`, `DELETE /events/{id}` |
| Backend | `app/utils/auth.py` | Supabase JWT verification (HS256 legacy + JWKS asymmetric) |
| Backend | `app/models/event.py` | `Event` document — `user_id`, `user_email` fields |
| Backend | `app/schemas/event.py` | `EventBase`, `EventOut` |
| Backend | `app/config.py` | `SUPABASE_URL`, `SUPABASE_JWT_SECRET` |
| Frontend | `src/pages/PostEventPage.jsx` | Gate + tabs + `MyPostsList` + `PostEventForm` + `PreviewPanel` + `SuccessCard` |
| Frontend | `src/components/AuthDialog.jsx` | Sign-in / sign-up modal |
| Frontend | `src/components/Header.jsx` | Header sign-in button + user chip |
| Frontend | `src/lib/supabase.js` | Supabase client (email + password) |
| Frontend | `src/lib/AuthProvider.jsx` | `useAuth()` — session, user, signIn/signUp/signOut |
| Frontend | `src/api/client.js` | axios interceptor attaches `Authorization: Bearer <jwt>` |
| Frontend | `src/api/events.js` | `createEvent`, `getMyEvents`, `deleteEvent` |

---

## 2. End-to-end data flow

1. Unauthed user hits `/post` → `PostEventPage` sees `!user` → renders `SignInGate` → clicks "Sign in to continue" → `AuthDialog` opens.
2. User signs up via Supabase (`supabase.auth.signUp({ email, password, options: { data: { name }}})`) or signs in.
3. Supabase issues a JWT (ES256 in this project). Session is persisted by `supabase-js` in `localStorage`.
4. `AuthProvider` fires `onAuthStateChange` → `session` populates → `useAuth()` returns `user`.
5. `PostEventPage` re-renders: gate lifts, tabs show. Default tab: **My posts**. React Query fires `GET /events/mine`.
6. Every axios call attaches `Authorization: Bearer <access_token>` via interceptor.
7. Backend `require_user` dependency:
   - Reads `alg` from token header.
   - If `HS256` → verify with `SUPABASE_JWT_SECRET` (legacy).
   - Otherwise → fetch JWKS from `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (cached), verify with the matching public key.
   - Returns `CurrentUser(id, email)`.
8. User picks **+ New event** → fills form → clicks Publish → `POST /events`:
   - `source` is forced to `"native"`.
   - `dedup_key` = source_url (if given) or `native:{user_id}:{title}:{date}`.
   - Embedding computed inline via `embed_texts()`.
   - `user_id`, `user_email` stamped on the doc.
   - Saved. `EventOut` returned.
9. `SuccessCard` shows, invalidates `["events", "mine"]`.
10. Delete: confirm via `window.confirm`, `DELETE /events/{id}` → backend re-checks `event.user_id == user.id` → deletes → cache invalidated.

**Assessment:** The flow is coherent and each layer is responsible for its own thing. ✅

---

## 3. Backend review

### `app/utils/auth.py` ✅

- Handles both legacy HS256 and new asymmetric (ES256/RS256) signing.
- Uses `PyJWKClient` with `cache_keys=True` so we don't hit Supabase on every request.
- Enforces `audience="authenticated"` — matches what Supabase issues.
- Distinct 401 vs 503 responses (`Auth is not configured` vs `Invalid session token`).
- `optional_user` is defined but currently unused — kept for future public-write endpoints (leave for now, no harm).

**Minor:** `_decode` swallows the specific `PyJWKClient` fetch error into the generic `InvalidTokenError` handler. If Supabase's JWKS endpoint is unreachable, the client sees "Invalid session token" — misleading. Consider catching `PyJWKClientError` separately and returning 503.

### `app/routers/events.py`

`POST /events` ✅ **works correctly.** But several concerns:

| Severity | Issue |
|---|---|
| 🔴 High | `EventBase` has no server-side length constraints. A user could POST `title=""`, `description="x" * 1_000_000`, or `tags=["x"] * 10_000`. Frontend validation is the only guard. |
| 🔴 High | `date` isn't validated against "today" — you can post an event dated `1999-01-01`. It'll be auto-deleted next ingestion run, but until then it clutters lookups. |
| 🟡 Medium | `end_date < date` is accepted. Same for `registration_deadline > date`. |
| 🟡 Medium | `source_url` accepts any string. Not required to be a URL. |
| 🟡 Medium | No rate limiting. A signed-in user could POST 100 events in a loop. |
| 🟡 Medium | Race condition on dedup: `find_one` → `insert` isn't atomic. Beanie's unique index will catch it as `DuplicateKeyError` → currently bubbles up as unhandled 500. |
| 🟡 Medium | Dedup key with a `source_url` is **global**. Two different users linking to the same Devfolio page collide, and the second one sees *"You already have an event with the same title, date or URL"* — but they don't; someone else does. |
| 🟢 Low | Embedding failure is a hard 502. Could gracefully save without the embedding (event still surfaces on Discover), and re-embed in a background job. |

`GET /events/mine` ✅ Correct. Returns the user's events sorted `-created_at`. Indexed by `user_id`.

`DELETE /events/{event_id}` ✅ Correctly re-verifies ownership. Two nits:

- Error message when trying to delete an ingested event: *"You can only unpublish your own events."* Confusing for an event that wasn't posted by any user. Consider: *"This event wasn't posted by you."*
- Delete is permanent — no soft-delete. Once removed, the user can't recover it.

Route ordering: `/mine` and `DELETE /{event_id}` come **before** `GET /{event_id}` ✅ — otherwise `/mine` would match `event_id="mine"`.

### `app/models/event.py`

- `user_id` + `user_email` fields added correctly.
- `user_id` indexed → `GET /events/mine` is fast.
- `user_email` snapshot: **will go stale** if the user changes their email in Supabase. Trade-off: it survives account deletion (good for attribution), but is not the source of truth. Not a bug — just document the invariant.

### `app/schemas/event.py`

- `EventBase` has no `Field(min_length=…, max_length=…)`. See the high-severity note above.
- `EventType` is a `Literal` — good, protects against garbage categories.

### `app/config.py`

- `SUPABASE_URL` and `SUPABASE_JWT_SECRET` clearly commented.
- `.env.example` documents both. ✅

---

## 4. Frontend review

### `AuthDialog.jsx`

**What's working:**

- Wipes state on close (no more pre-filled fields).
- `autoComplete="new-password"` on the signup form suppresses Chrome's autofill.
- Enter-to-submit on the password field.
- Handles the "confirmation-required" path (falls back to signin tab silently).
- Redirects to `/` after signin/signup so the user lands on Discover, not mid-form.

**Issues:**

| Severity | Issue |
|---|---|
| 🟡 Medium | Sign-in and sign-up show the same tagline (*"Post events and see the ones you've hosted."*). Feels lazy. |
| 🟡 Medium | No "Forgot password" link — users who forget are stuck. Supabase's `resetPasswordForEmail` is one line. |
| 🟡 Medium | Password field has no min-length hint. Supabase's default is 6 chars; user only finds out on submit. |
| 🟢 Low | Sign-out doesn't invalidate the `["events", "mine"]` query. If User A signs out and User B signs in in the same tab, User B briefly sees User A's cached posts. Fix: `queryClient.clear()` on sign-out. |
| 🟢 Low | The `initialMode` prop is passed but the header + gate both hardcode signin — signup mode is only reachable via the "Create an account" link. Fine, but noted. |
| 🟢 Low | No inline email format validation before hitting Supabase. |

### `PostEventPage.jsx` — top-level component

**What's working:**

- Auth gate ✅
- Loading state while `AuthProvider.loading === true` ✅
- Tabs (`My posts` / `+ New event`) with pill-style toggle ✅
- Empty state is editorial and inviting ✅
- Success card shows the created event and links to its detail page ✅

**Issues:**

| Severity | Issue |
|---|---|
| 🟡 Medium | No edit flow. To fix a typo, the user has to delete and re-post — which loses the event id, breaks any external link, and re-embeds. Add `PATCH /events/{id}`. |
| 🟡 Medium | No draft persistence. Refreshing the tab wipes the form. `localStorage.setItem("post-event-draft", ...)` on change + hydrate on mount. |
| 🟢 Low | On slow networks, `GET /events/mine` shows "Loading…" text — could show 2–3 skeleton event cards for polish. |
| 🟢 Low | `useMemo` is imported but only used inside `PreviewPanel`. Fine. |
| 🟢 Low | Category order in the form differs from Discover's order — trivial inconsistency. |
| 🟢 Low | Default category is `hackathon`. Consider no default so the user picks intentionally. |

### `MyPostsList`

**Issues:**

| Severity | Issue |
|---|---|
| 🟡 Medium | Delete uses `window.confirm` — clashes with the editorial UI everywhere else. Replace with an MUI `Dialog`. |
| 🟡 Medium | No optimistic UI on delete. After confirming, the user waits for the mutation, then the refetch. Optimistically remove the card, roll back on error. |
| 🟢 Low | Whole card wraps in `RouterLink` **except** the delete button. Correct, but the click affordances aren't visually distinct — the whole card looks clickable and the delete icon is small. |
| 🟢 Low | No "sort by / filter by category" for users with many events. Not needed yet. |

### `PostEventForm`

**Issues:**

| Severity | Issue |
|---|---|
| 🔴 High | No character limits on `title` (recommended: 120) or `description` (recommended: 2000). Pair with backend limits when added. |
| 🔴 High | No `source_url` URL validation (client or server). Paste `"foo"` and it submits. |
| 🟡 Medium | Native `<input type="date">` renders differently on every browser; on some it shows an overlapping "dd-mm-yyyy" placeholder that clashes with the MUI label. Switch to `@mui/x-date-pickers` for a consistent look. |
| 🟡 Medium | No cross-field validation: `endDate < date` and `regDeadline > date` are both accepted. |
| 🟡 Medium | Preview panel doesn't show `endDate` or `regDeadline` — so the user can't see them. |
| 🟢 Low | Tag input's Enter-to-add is undocumented in the UI. Add a helper line: *"Press Enter or +"*. |
| 🟢 Low | Sticky preview uses `top: 96` — a magic number. Break if header height ever changes. |
| 🟢 Low | React DOM warnings for `InputProps`, `InputLabelProps`, `flexWrap`, `alignItems`, `PaperProps` (legacy MUI props, deprecated). Migrate to `slotProps`. |

### `AuthProvider.jsx`

- Correctly subscribes to `onAuthStateChange` and unsubscribes on unmount.
- Loading state handled.
- Would be worth explicitly clearing React Query cache in `signOut` to prevent cross-user cache bleed.

### `api/client.js`

- axios request interceptor pulls the current session's `access_token` on every call. ✅ Handles token refresh transparently (supabase-js refreshes in the background).
- No response interceptor for 401 → sign out. On a stale session, user sees generic error. Could add: `if (err.response?.status === 401) { supabase.auth.signOut() }`.

---

## 5. Security review

| Concern | Status |
|---|---|
| Auth on write endpoints | ✅ `POST` and `DELETE` gated. |
| Ownership on delete | ✅ `event.user_id != user.id` → 403. |
| JWT signature verification | ✅ Both HS256 legacy and asymmetric handled. Audience check present. |
| JWKS caching | ✅ `PyJWKClient(cache_keys=True)`. |
| CORS | ✅ Limited to `FRONTEND_ORIGIN`. |
| CSRF | ✅ N/A — Bearer tokens in headers, not cookies. |
| Secret leakage | ✅ `SUPABASE_JWT_SECRET` server-side only. Frontend gets `publishable` key which is safe by design. `user_email` isn't exposed in `EventOut`. |
| Rate limiting | ❌ None. A signed-in user can DoS embedding calls, or spam events until the ingestion cleanup notices. |
| Input length caps | ❌ Missing. |
| URL validation | ❌ Missing. |

---

## 6. Lifecycle gaps

The following are missing features, not bugs — but they'll come up fast:

1. **Edit** — no way to update a posted event.
2. **Unpublish vs delete** — right now delete is destructive. A separate `is_published: bool` would let hosts hide without losing data.
3. **Drafts** — no way to save-in-progress. Refreshing wipes.
4. **Change email / delete account** — user has no way to delete their Supabase account from the app. Requires `supabase.auth.admin.deleteUser()` (needs the service_role key, so must be a backend endpoint).
5. **Attribution on public event cards** — Discover doesn't show "Posted by …" for native events. Users don't get credit; posted events look identical to scraped ones.
6. **Analytics for hosts** — "12 people saw this / 3 clicked through / 1 matched via resume."
7. **Password reset** — Supabase supports it, we don't surface it.

---

## 7. Prioritized suggestions

### Do next (correctness + trust):

1. **Add length constraints to `EventBase`** — `title: str = Field(min_length=3, max_length=120)`, `description: min_length=20, max_length=2000`, `tags: max_length=6, each str max 30`.
2. **Reject past dates and cross-field date issues** in the schema or route: `date >= today`, `end_date >= date`, `registration_deadline <= date`.
3. **Validate `source_url` as a URL** — `pydantic.HttpUrl` on the schema.
4. **Handle `DuplicateKeyError`** on insert — return 409 gracefully instead of an unhandled 500.
5. **Rate limit** `POST /events` — 10 posts / day / user is generous.

### Do soon (product feel):

6. **Replace `window.confirm` with an MUI Dialog** for delete.
7. **Optimistic UI on delete** — remove from list instantly, roll back on error.
8. **`PATCH /events/{id}`** — edit an event.
9. **Save form draft to `localStorage`** on every change.
10. **Add "Forgot password" link** to the sign-in dialog.

### Do eventually (polish + UX):

11. **Skeleton loaders** on My posts.
12. **MUI DatePicker** to replace native `<input type="date">`.
13. **Migrate off deprecated MUI props** (`InputProps` → `slotProps.input`, etc.) to kill the React warnings.
14. **Clear React Query cache on sign-out.**
15. **Handle 401 in axios response interceptor** — sign the user out cleanly.
16. **Show end date + registration deadline in the preview panel.**
17. **Show "Posted by <name>"** on Discover cards for native events.
18. **Character counters** on title + description as the user types.
19. **Better duplicate detection UX** — if the `source_url` collision is with someone else, say so; if it's with the same user, link them to their existing post.

---

## 8. Verdict

The Post Event section is a **working MVP** with real sign-in, real ownership, real persistence, and immediate discoverability of new events. That's a lot. But it will hit user-visible cracks the moment a real host tries to fix a typo (no edit), pastes a weird URL (no validation), gets kicked mid-form by a session expiry (no 401 handling), or forgets their password (no reset). The correctness fixes in section 7's first block are the shortest path to something you'd feel OK showing a stranger. Everything else is polish that can wait until you have hosts asking for it.

The auth wiring, JWT dual-mode verification, and per-user event scoping are the strongest parts of this section — they're what most side projects get wrong, and they're right here. Build the missing lifecycle features on top of them without changing the shape.
