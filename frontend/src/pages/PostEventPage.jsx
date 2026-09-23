import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Container, Box, Stack, Typography, TextField, Button, Chip, Switch,
  FormControlLabel, InputAdornment, Alert, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PlaceIcon from "@mui/icons-material/Place";
import LinkIcon from "@mui/icons-material/Link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import EastIcon from "@mui/icons-material/East";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { createEvent, deleteEvent, getMyEvents, updateEvent } from "../api/events";
import { useAuth } from "../lib/AuthProvider";
import AuthDialog from "../components/AuthDialog";
import { tokens } from "../theme";

const CATEGORIES = [
  { key: "hackathon",     label: "Hackathon" },
  { key: "startup",       label: "Startup" },
  { key: "workshop",      label: "Workshop" },
  { key: "conference",    label: "Conference" },
  { key: "networking",    label: "Networking" },
  { key: "communication", label: "Communication" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const parseDate = (iso) => {
  if (!iso) return { day: "—", mon: "—" };
  const [, m, d] = iso.split("-").map(Number);
  return { day: String(d || "").padStart(2, "0"), mon: MONTHS[(m || 1) - 1] };
};

const EMPTY = {
  title: "",
  description: "",
  type: "hackathon",
  date: "",
  endDate: "",
  regDeadline: "",
  online: false,
  city: "",
  sourceUrl: "",
  tags: [],
};

// Mirror the backend's UserEventCreate limits so users see errors before submit.
const LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 20, max: 2000 },
  tags: 6,
};

const isValidUrl = (s) => {
  if (!s) return true; // optional
  try { new URL(s); return true; } catch { return false; }
};

const today = () => new Date().toISOString().slice(0, 10);
// Max horizon: today + 3 years, matches backend MAX_YEARS_AHEAD.
const maxFutureDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 3);
  return d.toISOString().slice(0, 10);
};

// A DatePicker that speaks our form's YYYY-MM-DD string format.
// Manual typing is disabled — the entire field is click-to-open, and the
// only way to change the value is via the calendar popup.
function DateField({ label, value, onChange, onBlur, min, max, error }) {
  const [open, setOpen] = useState(false);
  const dayjsValue = value ? dayjs(value) : null;
  const minValue = min ? dayjs(min) : undefined;
  const maxValue = max ? dayjs(max) : undefined;
  const hasError = Boolean(error);

  return (
    <DatePicker
      label={label}
      value={dayjsValue}
      onChange={(next) => {
        if (next === null) return onChange("");
        if (!next.isValid()) return; // shouldn't happen (no typing), but safe
        onChange(next.format("YYYY-MM-DD"));
      }}
      minDate={minValue}
      maxDate={maxValue}
      format="YYYY-MM-DD"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      slotProps={{
        textField: {
          fullWidth: true,
          onBlur,
          onClick: () => setOpen(true),
          error: hasError,
          helperText: error || " ",
          InputLabelProps: { shrink: true },
          inputProps: { readOnly: true, style: { cursor: "pointer" } },
        },
      }}
    />
  );
}

// Convert an EventOut from the API back into the form's shape for editing.
function formFromEvent(e) {
  return {
    title: e.title || "",
    description: e.description || "",
    type: e.type || "hackathon",
    date: e.date || "",
    endDate: e.end_date || "",
    regDeadline: e.registration_deadline || "",
    online: Boolean(e.online),
    city: e.city || "",
    sourceUrl: e.source_url || "",
    tags: Array.isArray(e.tags) ? [...e.tags] : [],
  };
}

// Turn an axios error into a printable string. FastAPI's validation errors
// arrive as { detail: [{loc, msg, type, input}] } — rendering that array
// directly crashes React, so we flatten each entry into "field: msg".
function formatApiError(error, fallback) {
  if (!error) return "";
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((x) => x !== "body").join(".") : "";
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .filter(Boolean)
      .join(" · ");
  }
  return fallback;
}

function validateForm(form) {
  const errors = {};
  const t = form.title.trim();
  if (t.length < LIMITS.title.min) errors.title = `At least ${LIMITS.title.min} characters.`;
  else if (t.length > LIMITS.title.max) errors.title = `At most ${LIMITS.title.max} characters.`;

  const d = form.description.trim();
  if (d.length < LIMITS.description.min) errors.description = `At least ${LIMITS.description.min} characters.`;
  else if (d.length > LIMITS.description.max) errors.description = `At most ${LIMITS.description.max} characters.`;

  const t0 = today();
  const tMax = maxFutureDate();
  if (!form.date) errors.date = "Pick a start date.";
  else if (form.date < t0) errors.date = "Start date can't be in the past.";
  else if (form.date > tMax) errors.date = "Start date is too far in the future (max 3 years).";

  if (form.endDate) {
    if (form.date && form.endDate < form.date) errors.endDate = "End must be on or after start.";
    else if (form.endDate > tMax) errors.endDate = "End date is too far in the future (max 3 years).";
  }
  if (form.regDeadline) {
    if (form.date && form.regDeadline > form.date) errors.regDeadline = "Deadline must be on or before the start date.";
    else if (form.regDeadline < t0) errors.regDeadline = "Deadline can't be in the past.";
  }

  if (!form.online) {
    const city = form.city.trim();
    if (!city) errors.city = "City is required for in-person events.";
    else if (city.length > 80) errors.city = "At most 80 characters.";
  }

  const url = form.sourceUrl.trim();
  if (url) {
    if (url.length > 500) errors.sourceUrl = "URL is too long.";
    else if (!isValidUrl(url)) errors.sourceUrl = "Must be a valid https:// link.";
  }
  return errors;
}

export default function PostEventPage() {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  // "list" (my posts) | "new" (form). Signed-in users land on list; empty list auto-flips to form.
  const [tab, setTab] = useState("list");
  // The event currently being edited (when tab === "new" and this is set,
  // the form is in edit mode). null → creating a new event.
  const [editing, setEditing] = useState(null);

  const myPosts = useQuery({
    queryKey: ["events", "mine"],
    queryFn: getMyEvents,
    enabled: !!user,
  });

  // All hooks MUST run before any conditional return, otherwise the hook
  // count changes between renders and React throws "Rendered more hooks
  // than during the previous render."
  const goToList = useCallback(() => {
    setEditing(null);
    setTab("list");
  }, []);
  const startNew = useCallback(() => {
    setEditing(null);
    setTab("new");
  }, []);
  const startEdit = useCallback((e) => {
    setEditing(e);
    setTab("new");
  }, []);

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ pt: 14, textAlign: "center" }}>
        <CircularProgress sx={{ color: tokens.accent }} />
      </Container>
    );
  }

  if (!user) {
    return (
      <>
        <SignInGate onOpen={() => setAuthOpen(true)} />
        <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
      </>
    );
  }

  // Signed in: show tabs. Stay on "My posts" even when empty — the empty
  // state itself invites them to post.
  const events = myPosts.data || [];

  return (
    <Container maxWidth="lg" sx={{ pb: 10 }}>
      <TabBar tab={tab} setTab={setTab} count={events.length} editing={Boolean(editing)} />
      {tab === "list"
        ? <MyPostsList
            events={events}
            loading={myPosts.isLoading}
            onNew={startNew}
            onEdit={startEdit}
          />
        : <PostEventForm
            editing={editing}
            onPublished={goToList}
            onCancel={goToList}
          />}
    </Container>
  );
}

function SignInGate({ onOpen }) {
  return (
    <Container maxWidth="sm" sx={{ pt: 12, pb: 10, textAlign: "center" }}>
      <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: tokens.accentSoft, color: tokens.accent, display: "grid", placeItems: "center", mx: "auto", mb: 3 }}>
        <LockOutlinedIcon sx={{ fontSize: 28 }} />
      </Box>
      <Typography variant="h1" sx={{ fontSize: { xs: 32, md: 40 }, lineHeight: 1.05, mb: 2 }}>
        Sign in to <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>post an event.</Box>
      </Typography>
      <Typography sx={{ color: tokens.muted, fontSize: 16.5, lineHeight: 1.6, mb: 4 }}>
        Free while EventLoop is in beta. Takes a minute.
      </Typography>
      <Button variant="contained" size="large" onClick={onOpen} sx={{ px: 4, py: 1.4, fontSize: 15 }}>
        Sign in to continue
      </Button>
    </Container>
  );
}

function TabBar({ tab, setTab, count, editing = false }) {
  const Tab = ({ id, label }) => (
    <Box
      onClick={() => setTab(id)}
      sx={{
        cursor: "pointer",
        px: 2.5,
        py: 1.1,
        borderRadius: 100,
        fontSize: 14,
        fontWeight: 600,
        border: `1.5px solid ${tab === id ? tokens.accent : tokens.line}`,
        bgcolor: tab === id ? tokens.accentSoft : "transparent",
        color: tab === id ? tokens.accentDark : tokens.muted,
        transition: ".15s",
        "&:hover": { borderColor: tokens.accent, color: tokens.ink },
      }}
    >
      {label}
    </Box>
  );
  return (
    <Stack direction="row" spacing={1.25} sx={{ pt: 5 }}>
      <Tab id="list" label={`My posts${count ? ` · ${count}` : ""}`} />
      <Tab id="new" label={editing ? "Editing event" : "+ New event"} />
    </Stack>
  );
}

function MyPostsList({ events, loading, onNew, onEdit }) {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState(null); // event pending confirmation
  const del = useMutation({
    mutationFn: deleteEvent,
    // Optimistic: remove the card immediately, roll back on error.
    onMutate: async (eventId) => {
      await qc.cancelQueries({ queryKey: ["events", "mine"] });
      const previous = qc.getQueryData(["events", "mine"]);
      qc.setQueryData(["events", "mine"], (old = []) => old.filter((e) => e.id !== eventId));
      return { previous };
    },
    onError: (_err, _eventId, context) => {
      if (context?.previous) qc.setQueryData(["events", "mine"], context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["events", "mine"] }),
  });

  return (
    <Box sx={{ pt: 4 }}>
      <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 3 }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 34, md: 42 } }}>
          Your <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>posted events.</Box>
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 15, alignSelf: "flex-end", pb: 0.5 }}>
          {events.length} {events.length === 1 ? "event" : "events"}
        </Typography>
      </Stack>

      {loading && <Typography sx={{ color: tokens.muted, py: 4, textAlign: "center" }}>Loading…</Typography>}

      {!loading && events.length === 0 && (
        <Box
          sx={{
            mt: 2,
            py: { xs: 7, md: 9 },
            px: 3,
            textAlign: "center",
            border: `1.5px dashed ${tokens.line}`,
            borderRadius: 4,
            bgcolor: tokens.paper,
          }}
        >
          <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: tokens.accentSoft, color: tokens.accent, display: "grid", placeItems: "center", mx: "auto", mb: 3 }}>
            <AutoAwesomeIcon sx={{ fontSize: 26 }} />
          </Box>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: { xs: 24, md: 30 }, lineHeight: 1.15, mb: 1.5 }}>
            You haven't posted{" "}
            <Box component="em" sx={{ fontStyle: "italic", color: tokens.accent }}>anything yet.</Box>
          </Typography>
          <Typography sx={{ color: tokens.muted, fontSize: 15.5, lineHeight: 1.6, maxWidth: "42ch", mx: "auto", mb: 3.5 }}>
            When you host something — a hackathon, a workshop, a meetup — it'll live here.
          </Typography>
          <Button variant="contained" size="large" onClick={onNew} sx={{ px: 3.5, py: 1.35, fontSize: 14.5 }}>
            Post your first event
          </Button>
        </Box>
      )}

      <Stack spacing={2}>
        {events.map((e) => {
          const { day, mon } = parseDate(e.date);
          const catColor = tokens.category[e.type] || tokens.muted;
          return (
            <Box
              key={e.id}
              sx={{
                bgcolor: tokens.paper,
                border: `1px solid ${tokens.line}`,
                borderRadius: 3,
                p: 2.5,
                boxShadow: "0 1px 2px rgba(60,40,20,.03)",
                display: "flex",
                gap: 2.5,
                alignItems: "center",
              }}
            >
              <Box sx={{ textAlign: "center", minWidth: 60, borderRight: `1px solid ${tokens.line}`, pr: 2.5 }}>
                <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 24, lineHeight: 1 }}>{day}</Typography>
                <Typography sx={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: tokens.muted, mt: 0.4 }}>{mon}</Typography>
              </Box>
              <Box component={RouterLink} to={`/events/${e.id}`} sx={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: catColor, flexShrink: 0, display: "block" }} />
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: 1, display: "flex", alignItems: "center" }}>
                    {e.type}
                  </Typography>
                </Stack>
                <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 18, lineHeight: 1.25 }}>
                  {e.title}
                </Typography>
                <Typography sx={{ color: tokens.muted, fontSize: 13, mt: 0.5 }}>
                  {e.online ? "🌐 Online" : `📍 ${e.city || "—"}`}
                </Typography>
              </Box>
              <IconButton
                onClick={() => onEdit(e)}
                sx={{ color: tokens.muted, "&:hover": { color: tokens.accent, bgcolor: tokens.accentSoft } }}
                title="Edit"
              >
                <EditOutlinedIcon />
              </IconButton>
              <IconButton
                onClick={() => setToDelete(e)}
                sx={{ color: tokens.muted, "&:hover": { color: "#c94f4f", bgcolor: "#fce9e9" } }}
                title="Unpublish"
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          );
        })}
      </Stack>

      <ConfirmDeleteDialog
        event={toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) del.mutate(toDelete.id);
          setToDelete(null);
        }}
      />
    </Box>
  );
}

function ConfirmDeleteDialog({ event, onCancel, onConfirm }) {
  return (
    <Dialog
      open={Boolean(event)}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, bgcolor: tokens.paper, boxShadow: tokens.shadow } }}
    >
      <DialogTitle sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 22, pt: 3.5, px: 3.5, pb: 1 }}>
        Unpublish this event?
      </DialogTitle>
      <DialogContent sx={{ px: 3.5, pb: 1 }}>
        <Typography sx={{ color: tokens.muted, fontSize: 14.5, lineHeight: 1.55 }}>
          “{event?.title}” will be removed from Discover and For You. This can't be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onCancel} sx={{ color: tokens.muted }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{ bgcolor: "#c94f4f", "&:hover": { bgcolor: "#a93c3c" } }}
        >
          Unpublish
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PostEventForm({ editing, onPublished, onCancel }) {
  const qc = useQueryClient();
  const isEdit = Boolean(editing);
  const [form, setForm] = useState(() => (editing ? formFromEvent(editing) : EMPTY));
  const [tagDraft, setTagDraft] = useState("");
  const [touched, setTouched] = useState({});

  const mutation = useMutation({
    mutationFn: isEdit
      ? (body) => updateEvent({ id: editing.id, ...body })
      : createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", "mine"] });
      // Edit path: leave the form immediately. Create path: let the SuccessCard
      // render (via `published` truthy check below).
      if (isEdit) onPublished?.();
    },
  });
  const published = mutation.data;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const fieldErrors = validateForm(form);
  const canSubmit = Object.keys(fieldErrors).length === 0;
  const shownError = (k) => (touched[k] ? fieldErrors[k] : undefined);

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t || form.tags.includes(t) || form.tags.length >= LIMITS.tags) return;
    if (t.length > 30) return;
    set("tags")([...form.tags, t]);
    setTagDraft("");
  };
  const removeTag = (t) => set("tags")(form.tags.filter((x) => x !== t));

  const submit = () => {
    if (!canSubmit) {
      // Mark all fields touched so their helperText appears.
      setTouched(Object.fromEntries(Object.keys(fieldErrors).map((k) => [k, true])));
      return;
    }
    const fullBody = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      date: form.date,
      end_date: form.endDate || null,
      registration_deadline: form.regDeadline || null,
      city: form.online ? null : (form.city.trim() || null),
      online: form.online,
      source_url: form.sourceUrl.trim() || null,
      tags: form.tags,
    };
    if (isEdit) {
      // PATCH: send only the fields the user actually changed, so a stored
      // value that predates a validation rule doesn't get rejected here.
      const original = formFromEvent(editing);
      const originalBody = {
        title: original.title,
        description: original.description,
        type: original.type,
        date: original.date,
        end_date: original.endDate || null,
        registration_deadline: original.regDeadline || null,
        city: original.online ? null : (original.city || null),
        online: original.online,
        source_url: original.sourceUrl || null,
        tags: original.tags,
      };
      const patch = {};
      for (const [k, v] of Object.entries(fullBody)) {
        const originalValue = originalBody[k];
        const changed = Array.isArray(v)
          ? JSON.stringify(v) !== JSON.stringify(originalValue)
          : v !== originalValue;
        if (changed) patch[k] = v;
      }
      // Nothing changed → treat as success without an API call.
      if (Object.keys(patch).length === 0) {
        onPublished?.();
        return;
      }
      mutation.mutate(patch);
    } else {
      mutation.mutate({ ...fullBody, source: "native" });
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setTagDraft("");
    setTouched({});
    mutation.reset();
  };

  const backToList = () => {
    reset();
    onPublished?.();
  };

  if (published && !isEdit) return <SuccessCard event={published} onReset={reset} onBack={backToList} />;

  const apiError = formatApiError(
    mutation.error,
    isEdit ? "Could not save changes. Try again." : "Could not publish the event. Try again.",
  );

  return (
    <Box>
      {/* Hero */}
      <Box sx={{ pt: 6, pb: 5, maxWidth: 720 }}>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tokens.accent, boxShadow: `0 0 0 4px ${tokens.accentSoft}` }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.accentDark, letterSpacing: "0.4px", textTransform: "uppercase" }}>
            {isEdit ? "Editing your event" : "Post an event · free while in beta"}
          </Typography>
        </Stack>
        <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 56 }, lineHeight: 1.02 }}>
          {isEdit ? (
            <>Make it{" "}<Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>even better.</Box></>
          ) : (
            <>Host something{" "}<Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>worth showing up for.</Box></>
          )}
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 18, mt: 2.5, maxWidth: "52ch", lineHeight: 1.6 }}>
          {isEdit
            ? "Update anything about your event. Changes go live immediately."
            : "Put your hackathon, workshop or meetup in front of the right people — matched to their skills and goals, not blasted to a mailing list."}
        </Typography>
      </Box>

      {/* Two column layout: form + live preview */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
          gap: { xs: 4, md: 6 },
          alignItems: "start",
        }}
      >
        {/* Form */}
        <Stack spacing={4}>
          <Section title="The basics">
            <TextField
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              onBlur={() => touch("title")}
              placeholder="e.g. Hyderabad AI Builders Hackathon"
              fullWidth
              label="Event title"
              InputLabelProps={{ shrink: true }}
              inputProps={{ maxLength: LIMITS.title.max }}
              error={Boolean(shownError("title"))}
              helperText={shownError("title") || `${form.title.length}/${LIMITS.title.max}`}
            />
            <TextField
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              onBlur={() => touch("description")}
              placeholder="One or two paragraphs on what it is, who it's for, and why they should come."
              multiline
              minRows={4}
              fullWidth
              label="Description"
              InputLabelProps={{ shrink: true }}
              inputProps={{ maxLength: LIMITS.description.max }}
              error={Boolean(shownError("description"))}
              helperText={shownError("description") || `${form.description.length}/${LIMITS.description.max}`}
            />
          </Section>

          <Section title="Category">
            <Stack direction="row" flexWrap="wrap" gap={1.25}>
              {CATEGORIES.map((c) => {
                const active = form.type === c.key;
                const color = tokens.category[c.key] || tokens.accent;
                return (
                  <Box
                    key={c.key}
                    onClick={() => set("type")(c.key)}
                    sx={{
                      cursor: "pointer",
                      px: 2,
                      py: 1.1,
                      borderRadius: 100,
                      fontSize: 13.5,
                      fontWeight: 600,
                      border: `1.5px solid ${active ? color : tokens.line}`,
                      bgcolor: active ? `${color}15` : tokens.paper,
                      color: active ? color : tokens.ink,
                      display: "flex",
                      alignItems: "center",
                      gap: 0.9,
                      transition: ".15s",
                      "&:hover": { borderColor: color },
                    }}
                  >
                    {c.label}
                  </Box>
                );
              })}
            </Stack>
          </Section>

          <Section title="When">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <DateField
                label="Starts"
                value={form.date}
                onChange={set("date")}
                onBlur={() => touch("date")}
                min={today()}
                max={maxFutureDate()}
                error={shownError("date")}
              />
              <DateField
                label="Ends (optional)"
                value={form.endDate}
                onChange={set("endDate")}
                onBlur={() => touch("endDate")}
                min={form.date || today()}
                max={maxFutureDate()}
                error={shownError("endDate")}
              />
            </Stack>
            <DateField
              label="Registration deadline (optional)"
              value={form.regDeadline}
              onChange={set("regDeadline")}
              onBlur={() => touch("regDeadline")}
              min={today()}
              max={form.date || maxFutureDate()}
              error={shownError("regDeadline")}
            />
          </Section>

          <Section title="Where">
            <FormControlLabel
              control={
                <Switch
                  checked={form.online}
                  onChange={(e) => set("online")(e.target.checked)}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: tokens.accent },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: tokens.accent },
                  }}
                />
              }
              label={<Typography sx={{ fontSize: 14, fontWeight: 500 }}>Fully online</Typography>}
            />
            {!form.online && (
              <TextField
                value={form.city}
                onChange={(e) => set("city")(e.target.value)}
                onBlur={() => touch("city")}
                placeholder="Hyderabad"
                label="City"
                InputLabelProps={{ shrink: true }}
                inputProps={{ maxLength: 80 }}
                error={Boolean(shownError("city"))}
                helperText={shownError("city")}
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon sx={{ fontSize: 18, color: tokens.muted }} /></InputAdornment> }}
              />
            )}
          </Section>

          <Section title="Tags & registration link">
            <Stack direction="row" spacing={1} alignItems="stretch">
              <TextField
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="e.g. GenAI, MERN, students-welcome"
                label="Add a tag"
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <Button
                onClick={addTag}
                variant="outlined"
                sx={{
                  borderColor: tokens.line,
                  color: tokens.ink,
                  minWidth: 52,
                  "&:hover": { borderColor: tokens.accent, bgcolor: tokens.accentSoft },
                }}
              >
                <AddIcon />
              </Button>
            </Stack>
            {form.tags.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={0.9}>
                {form.tags.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    size="small"
                    onDelete={() => removeTag(t)}
                    deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                    sx={{ bgcolor: tokens.paper, border: `1px solid ${tokens.line}`, color: tokens.ink, fontWeight: 500 }}
                  />
                ))}
              </Stack>
            )}
            <TextField
              value={form.sourceUrl}
              onChange={(e) => set("sourceUrl")(e.target.value)}
              onBlur={() => touch("sourceUrl")}
              placeholder="https://…"
              label="Registration URL"
              InputLabelProps={{ shrink: true }}
              error={Boolean(shownError("sourceUrl"))}
              helperText={shownError("sourceUrl")}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><LinkIcon sx={{ fontSize: 18, color: tokens.muted }} /></InputAdornment> }}
            />
          </Section>

          {apiError && <Alert severity="error">{apiError}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ pt: 1 }}>
            <Button
              variant="contained"
              size="large"
              onClick={submit}
              disabled={mutation.isPending || !canSubmit}
              endIcon={<EastIcon />}
              sx={{ px: 4, py: 1.5, fontSize: 15 }}
            >
              {mutation.isPending
                ? (isEdit ? "Saving…" : "Publishing…")
                : (isEdit ? "Save changes" : "Publish event")}
            </Button>
            {isEdit && (
              <Button onClick={onCancel} sx={{ color: tokens.muted }}>
                Cancel
              </Button>
            )}
            {!isEdit && (
              <Typography component="span" sx={{ fontSize: 12.5, color: tokens.muted, display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
                Goes live on the feed the moment you publish.
              </Typography>
            )}
          </Stack>
        </Stack>

        {/* Live preview */}
        <PreviewPanel form={form} />
      </Box>
    </Box>
  );
}

/* ---------- sub-components ---------- */

function Section({ title, children }) {
  return (
    <Box>
      <Typography variant="h2" sx={{ fontSize: 22, mb: 2 }}>{title}</Typography>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}

function PreviewPanel({ form }) {
  const { day, mon } = useMemo(() => parseDate(form.date), [form.date]);
  const cat = CATEGORIES.find((c) => c.key === form.type);
  const catColor = tokens.category[form.type] || tokens.accent;

  return (
    <Box sx={{ position: { md: "sticky" }, top: { md: 96 } }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: tokens.muted, mb: 1.5 }}>
        Live preview
      </Typography>
      <Box
        sx={{
          bgcolor: tokens.paper,
          border: `1px solid ${tokens.line}`,
          borderRadius: 4,
          p: { xs: 2.5, md: 3.25 },
          boxShadow: tokens.shadow,
        }}
      >
        <Stack direction="row" spacing={2.5} alignItems="flex-start">
          <Box sx={{ textAlign: "center", minWidth: 68, borderRight: `1px solid ${tokens.line}`, pr: 2.5 }}>
            <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 30, lineHeight: 1 }}>{day}</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: tokens.muted, mt: 0.4 }}>{mon}</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: catColor, flexShrink: 0, display: "block" }} />
              <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: 1, display: "flex", alignItems: "center" }}>
                {cat?.label || "Event"}
              </Typography>
            </Stack>
            <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 22, lineHeight: 1.2, mb: 1 }}>
              {form.title || "Your event title"}
            </Typography>
            <Typography sx={{ color: tokens.muted, fontSize: 14, lineHeight: 1.55, mb: 1.5 }}>
              {form.description
                ? form.description.length > 160 ? form.description.slice(0, 160) + "…" : form.description
                : "A short teaser will appear here as you write."}
            </Typography>
            <Stack direction="row" spacing={2} sx={{ color: tokens.muted, fontSize: 13.5, fontWeight: 500 }}>
              <span>{form.online ? "🌐 Online" : `📍 ${form.city || "City"}`}</span>
              <span>via native</span>
            </Stack>
            {form.tags.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.75 }}>
                {form.tags.map((t) => (
                  <Chip key={t} label={t} size="small" sx={{ bgcolor: tokens.cream, border: `1px solid ${tokens.line}`, fontWeight: 500 }} />
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </Box>

    </Box>
  );
}

function SuccessCard({ event, onReset, onBack }) {
  const { day, mon } = parseDate(event.date);
  const catColor = tokens.category[event.type] || tokens.accent;
  return (
    <Container maxWidth="sm" sx={{ pt: 10, pb: 10, textAlign: "center" }}>
      <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: tokens.accentSoft, color: tokens.accent, display: "grid", placeItems: "center", mx: "auto", mb: 3 }}>
        <AutoAwesomeIcon sx={{ fontSize: 30 }} />
      </Box>
      <Typography variant="h1" sx={{ fontSize: { xs: 34, md: 42 }, lineHeight: 1.05, mb: 2 }}>
        You just{" "}
        <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>
          published an event.
        </Box>
      </Typography>
      <Typography sx={{ color: tokens.muted, fontSize: 16.5, lineHeight: 1.6, mb: 4 }}>
        “{event.title}” is live on the feed and being matched to attendees right now.
      </Typography>
      <Box
        component={RouterLink}
        to={`/events/${event.id}`}
        sx={{ display: "block", bgcolor: tokens.paper, border: `1px solid ${tokens.line}`, borderRadius: 3, p: 2.5, textAlign: "left", boxShadow: tokens.shadow, textDecoration: "none", color: "inherit", transition: ".15s", "&:hover": { borderColor: "#d8cdb8", transform: "translateY(-2px)" } }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "center", minWidth: 56 }}>
            <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 24, lineHeight: 1 }}>{day}</Typography>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: tokens.muted }}>{mon}</Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: catColor, flexShrink: 0, display: "block" }} />
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: 1, display: "flex", alignItems: "center" }}>{event.type}</Typography>
            </Stack>
            <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 17, mt: 0.4 }}>{event.title}</Typography>
          </Box>
        </Stack>
      </Box>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Button onClick={onBack} sx={{ color: tokens.muted, fontSize: 13.5 }}>
          See my posts
        </Button>
        <Button onClick={onReset} sx={{ color: tokens.muted, fontSize: 13.5 }}>
          Post another event
        </Button>
      </Stack>
    </Container>
  );
}
