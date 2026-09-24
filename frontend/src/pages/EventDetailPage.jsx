import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Container, Box, Stack, Typography, Button, Chip, Skeleton, Menu, MenuItem, Snackbar } from "@mui/material";
import WestIcon from "@mui/icons-material/West";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PublicIcon from "@mui/icons-material/Public";
import PlaceIcon from "@mui/icons-material/Place";
import GroupsIcon from "@mui/icons-material/Groups";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import IosShareIcon from "@mui/icons-material/IosShare";
import { getEvent, getEvents } from "../api/events";
import { deleteTeammatePost, getTeammatesForEvent } from "../api/teammates";
import { useAuth } from "../lib/AuthProvider";
import AuthDialog from "../components/AuthDialog";
import TeammateCard from "../components/TeammateCard";
import TeammateDialog from "../components/TeammateDialog";
import { tokens } from "../theme";

function fullDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// "24 Oct – 1 Nov 2026" for multi-day events, else the full single date.
function whenText(startIso, endIso) {
  if (endIso && endIso !== startIso) return `${shortDate(startIso)} – ${fullDate(endIso)}`;
  return fullDate(startIso);
}

// ---- .ics download ----
// Build a valid iCalendar file for the event and hand the browser a Blob to
// download. Works with Apple Calendar / Google / Outlook / Fantastical.
function icsEscape(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// YYYY-MM-DD → YYYYMMDD (all-day event in iCal uses DATE, not DATETIME).
const icsDate = (iso) => iso.replace(/-/g, "");

function buildIcs(event) {
  const uid = `${event.id}@eventloop`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = icsDate(event.date);
  // DTEND is exclusive in iCal, so add a day if end_date is given, else use start+1.
  const endIso = event.end_date || event.date;
  const [y, m, d] = endIso.split("-").map(Number);
  const endPlusOne = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const dtend = icsDate(endPlusOne);
  const location = event.online ? "Online" : (event.city || "");
  const summary = event.title;
  const desc = [event.description, event.source_url && `Register: ${event.source_url}`]
    .filter(Boolean)
    .join("\n\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventLoop//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    location && `LOCATION:${icsEscape(location)}`,
    event.source_url && `URL:${icsEscape(event.source_url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function downloadIcs(event) {
  const ics = buildIcs(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^\w-]+/g, "-").slice(0, 60) || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Same YYYYMMDD → YYYYMMDD (end exclusive) format as the .ics DTSTART/DTEND.
function calendarRange(event) {
  const start = icsDate(event.date);
  const endIso = event.end_date || event.date;
  const [y, m, d] = endIso.split("-").map(Number);
  const endPlusOne = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return `${start}/${icsDate(endPlusOne)}`;
}

// Deep link that opens Google Calendar's "Add event" screen with the fields
// prefilled. Works signed-in or not (Google prompts to sign in).
function googleCalendarUrl(event) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: calendarRange(event),
    details: [event.description, event.source_url && `Register: ${event.source_url}`]
      .filter(Boolean)
      .join("\n\n"),
    location: event.online ? "Online" : (event.city || ""),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Deep link for Outlook Web's "New event" screen.
function outlookCalendarUrl(event) {
  // Outlook expects ISO dates, not YYYYMMDD.
  const endIso = event.end_date || event.date;
  const [y, m, d] = endIso.split("-").map(Number);
  const endPlusOne = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: event.date,
    enddt: endPlusOne,
    subject: event.title,
    body: [event.description, event.source_url && `Register: ${event.source_url}`]
      .filter(Boolean)
      .join("\n\n"),
    location: event.online ? "Online" : (event.city || ""),
    allday: "true",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [teamOpen, setTeamOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [calAnchor, setCalAnchor] = useState(null);
  const [toast, setToast] = useState("");

  // On mobile: OS share sheet. On desktop: copy to clipboard. On both, a
  // <textarea> `execCommand` fallback covers older browsers or blocked APIs.
  const share = async () => {
    const url = window.location.href;
    const title = event?.title || "EventLoop";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Mobile: try native share sheet first.
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title, url });
        return; // shared successfully
      } catch (err) {
        // AbortError = user dismissed the sheet — don't show anything.
        if (err?.name === "AbortError") return;
        // Anything else → fall through to clipboard copy below.
      }
    }

    // Copy to clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
      return;
    } catch { /* fall through */ }

    // Last-resort fallback for old browsers / permission-blocked clipboard.
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setToast("Link copied");
    } catch {
      setToast("Couldn't copy the link. Please copy it from the URL bar.");
    }
  };

  // Return to wherever the user came from (Discover, My posts, For You, …).
  // If they landed on this page via a direct URL / share link, fall back to
  // the Discover home so they don't get bounced off the site.
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.state?.idx > 0) navigate(-1);
    else navigate("/");
  };

  const { data: teammates = [] } = useQuery({
    queryKey: ["teammates", "event", id],
    queryFn: () => getTeammatesForEvent(id),
    enabled: Boolean(id),
  });

  const withdraw = useMutation({
    mutationFn: deleteTeammatePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teammates", "event", id] }),
  });

  const myPost = user ? teammates.find((t) => t.user_id === user.id) : null;

  const openTeamFlow = () => {
    if (!user) { setAuthOpen(true); return; }
    setTeamOpen(true);
  };

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ["event", id],
    queryFn: () => getEvent(id),
  });
  const { data: allEvents = [] } = useQuery({ queryKey: ["events"], queryFn: () => getEvents() });

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="rounded" height={250} sx={{ borderRadius: 3, mb: 4 }} />
        <Skeleton width="60%" height={50} />
        <Skeleton width="90%" />
        <Skeleton width="80%" />
      </Container>
    );
  }
  if (isError || !event) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: "center" }}>
        <Typography sx={{ color: tokens.muted }}>Event not found.</Typography>
        <Button onClick={goBack} sx={{ mt: 2 }}>Back to events</Button>
      </Container>
    );
  }

  const catColor = tokens.category[event.type] || tokens.accent;
  const related = allEvents.filter((e) => e.type === event.type && e.id !== event.id).slice(0, 3);

  return (
    <Container maxWidth="lg" sx={{ pb: 8 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 3 }}>
        <Box onClick={goBack} sx={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 1, color: tokens.muted, fontSize: 14, fontWeight: 500, "&:hover": { color: tokens.ink } }}>
          <WestIcon sx={{ fontSize: 18 }} /> Back to events
        </Box>
      </Stack>

      {/* Banner */}
      <Box
        sx={{
          height: 240,
          borderRadius: 3,
          background: `radial-gradient(130% 130% at 18% 0%, ${catColor} 0%, #241a12 100%)`,
          position: "relative",
          overflow: "hidden",
          boxShadow: tokens.shadow,
        }}
      >
        <Chip label={event.type} sx={{ position: "absolute", top: 20, left: 22, bgcolor: "rgba(0,0,0,.25)", color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", fontSize: 12 }} />
        <Box sx={{ position: "absolute", top: 20, right: 22, bgcolor: "rgba(255,255,255,.18)", color: "#fff", fontSize: 13, fontWeight: 600, px: 1.75, py: 0.75, borderRadius: 100, backdropFilter: "blur(6px)" }}>
          via {event.source}
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 340px" }, gap: 5, mt: 4, alignItems: "start" }}>
        {/* Main */}
        <Box>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 4 }}>
            <Typography variant="h1" sx={{ fontSize: { xs: 32, md: 42 }, lineHeight: 1.05, flex: 1 }}>
              {event.title}
            </Typography>
            {user && event.user_id === user.id && (
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                onClick={() => navigate("/post", { state: { editEvent: event } })}
                sx={{ mt: 1, borderColor: tokens.line, color: tokens.ink, flexShrink: 0 }}
              >
                Edit
              </Button>
            )}
          </Stack>

          <Section title="About this event">
            <Typography sx={{ color: "#4a463d", fontSize: 16, lineHeight: 1.75 }}>{event.description}</Typography>
          </Section>

          {event.tags?.length > 0 && (
            <Section title="Topics">
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {event.tags.map((t) => (
                  <Chip key={t} label={t} variant="outlined" sx={{ borderColor: tokens.line, color: tokens.muted, bgcolor: tokens.paper }} />
                ))}
              </Stack>
            </Section>
          )}

          <Section title="Hosted by">
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ bgcolor: tokens.paper, border: `1px solid ${tokens.line}`, borderRadius: 2, p: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: tokens.accentSoft, color: tokens.accentDark, display: "grid", placeItems: "center", fontFamily: tokens.serif, fontWeight: 700 }}>
                {event.source === "native" && event.user_name
                  ? event.user_name.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()
                  : event.source.slice(0, 2).toUpperCase()}
              </Box>
              <Box>
                {event.source === "native" ? (
                  <>
                    <Typography sx={{ fontWeight: 600, fontSize: 15 }}>
                      Posted by {event.user_name || "a community member"}
                    </Typography>
                    <Typography sx={{ color: tokens.muted, fontSize: 13 }}>Community host</Typography>
                  </>
                ) : (
                  <>
                    <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Aggregated from {event.source}</Typography>
                    <Typography sx={{ color: tokens.muted, fontSize: 13 }}>Verified source</Typography>
                  </>
                )}
              </Box>
            </Stack>
          </Section>

          {event.type === "hackathon" && (
            <Section>
              <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={2} sx={{ bgcolor: "#f1ede2", border: "1px dashed #d8cdb8", borderRadius: 2, p: 2.5 }}>
                <Box sx={{ width: 46, height: 46, borderRadius: 1.5, bgcolor: tokens.ink, color: "#fff", display: "grid", placeItems: "center" }}>
                  <GroupsIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 17 }}>
                    {myPost ? "You're on the teammate board" : "Looking for a team?"}
                  </Typography>
                  <Typography sx={{ color: tokens.muted, fontSize: 13.5 }}>
                    {myPost
                      ? "People viewing this event can see your pitch."
                      : `${teammates.length} ${teammates.length === 1 ? "person is" : "people are"} looking so far.`}
                  </Typography>
                </Box>
                {myPost ? (
                  <Button
                    variant="outlined"
                    onClick={() => withdraw.mutate(myPost.id)}
                    disabled={withdraw.isPending}
                    sx={{ borderColor: tokens.line, color: tokens.ink }}
                  >
                    Withdraw
                  </Button>
                ) : (
                  <Button variant="contained" onClick={openTeamFlow}>
                    I'm looking for teammates
                  </Button>
                )}
              </Stack>
            </Section>
          )}

          {event.type === "hackathon" && teammates.length > 0 && (
            <Section title={`Teammates for this hackathon · ${teammates.length}`}>
              <Stack spacing={2}>
                {teammates.map((t) => (
                  <TeammateCard
                    key={t.id}
                    post={t}
                    showEvent={false}
                    canDelete={user?.id === t.user_id}
                    onDelete={() => withdraw.mutate(t.id)}
                  />
                ))}
              </Stack>
            </Section>
          )}

          {related.length > 0 && (
            <Section title="You might also like">
              <Stack>
                {related.map((r) => (
                  <Box key={r.id} component={Link} to={`/events/${r.id}`} sx={{ display: "flex", gap: 2, alignItems: "center", py: 1.75, borderTop: `1px solid ${tokens.line}` }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tokens.category[r.type] || tokens.muted }} />
                    <Box>
                      <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 16 }}>{r.title}</Typography>
                      <Typography sx={{ color: tokens.muted, fontSize: 13 }}>{r.online ? "Online" : r.city} · via {r.source}</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Section>
          )}
        </Box>

        {/* Sticky register card */}
        <Box sx={{ position: { md: "sticky" }, top: 88, bgcolor: tokens.paper, border: `1px solid ${tokens.line}`, borderRadius: 3, p: 3, boxShadow: tokens.shadow }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: ".5px", textTransform: "uppercase", color: tokens.muted }}>When</Typography>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 22, mt: 0.5 }}>{whenText(event.date, event.end_date)}</Typography>

          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ py: 1.75, mt: 2, borderTop: `1px solid ${tokens.line}`, color: "#4a463d", fontSize: 14.5 }}>
            {event.online ? <PublicIcon sx={{ fontSize: 18, color: "#b3ab9c" }} /> : <PlaceIcon sx={{ fontSize: 18, color: "#b3ab9c" }} />}
            <span>{event.online ? "Online" : event.city || "—"}</span>
          </Stack>

          {event.registration_deadline && (
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, bgcolor: "#fdeee7", color: tokens.accentDark, fontSize: 13, fontWeight: 600, px: 1.5, py: 1, borderRadius: 100, mb: 2 }}>
              Registration closes on {fullDate(event.registration_deadline)}
            </Box>
          )}

          {event.source_url ? (
            <Button
              fullWidth
              variant="contained"
              color="primary"
              endIcon={<NorthEastIcon />}
              href={event.source_url}
              target="_blank"
              rel="noreferrer"
              sx={{ py: 1.5, mb: 1.25 }}
            >
              {event.source === "native" ? "Register" : `Register on ${event.source}`}
            </Button>
          ) : (
            <Button fullWidth variant="contained" disabled sx={{ py: 1.5, mb: 1.25 }}>
              No registration link
            </Button>
          )}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<CalendarMonthIcon />}
            onClick={(e) => setCalAnchor(e.currentTarget)}
            sx={{ py: 1.5, borderColor: tokens.line, color: tokens.ink, mb: 1 }}
          >
            Add to calendar
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<IosShareIcon />}
            onClick={share}
            sx={{ py: 1.5, borderColor: tokens.line, color: tokens.ink }}
          >
            Share event
          </Button>
          <Menu
            anchorEl={calAnchor}
            open={Boolean(calAnchor)}
            onClose={() => setCalAnchor(null)}
            PaperProps={{ sx: { mt: 1, borderRadius: 3, minWidth: 260, border: `1px solid ${tokens.line}`, boxShadow: tokens.shadow } }}
          >
            <MenuItem
              onClick={() => { window.open(googleCalendarUrl(event), "_blank", "noopener"); setCalAnchor(null); }}
              sx={{ fontSize: 14.5, py: 1.25 }}
            >
              Google Calendar
            </MenuItem>
            <MenuItem
              onClick={() => { window.open(outlookCalendarUrl(event), "_blank", "noopener"); setCalAnchor(null); }}
              sx={{ fontSize: 14.5, py: 1.25 }}
            >
              Outlook
            </MenuItem>
            <MenuItem
              onClick={() => { downloadIcs(event); setCalAnchor(null); }}
              sx={{ fontSize: 14.5, py: 1.25 }}
            >
              Apple Calendar / other (.ics)
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <TeammateDialog open={teamOpen} onClose={() => setTeamOpen(false)} event={event} />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
      <Snackbar
        open={Boolean(toast)}
        onClose={() => setToast("")}
        autoHideDuration={2600}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        ContentProps={{ sx: { bgcolor: tokens.ink, color: "#fff", fontWeight: 500, borderRadius: 100, px: 2.5 } }}
      />
    </Container>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 4 }}>
      {title && <Typography variant="h2" sx={{ fontSize: 22, mb: 1.75 }}>{title}</Typography>}
      {children}
    </Box>
  );
}
