import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Container, Box, Stack, Typography, Button, Chip, Skeleton } from "@mui/material";
import WestIcon from "@mui/icons-material/West";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PublicIcon from "@mui/icons-material/Public";
import PlaceIcon from "@mui/icons-material/Place";
import GroupsIcon from "@mui/icons-material/Groups";
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

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [teamOpen, setTeamOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

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
          <Typography variant="h1" sx={{ fontSize: { xs: 32, md: 42 }, lineHeight: 1.05, mb: 4 }}>
            {event.title}
          </Typography>

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
                {event.source.slice(0, 2).toUpperCase()}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: 15 }}>Aggregated from {event.source}</Typography>
                <Typography sx={{ color: tokens.muted, fontSize: 13 }}>Verified source</Typography>
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

          <Button
            fullWidth
            variant="contained"
            color="primary"
            endIcon={<NorthEastIcon />}
            href={event.source_url || undefined}
            target="_blank"
            rel="noreferrer"
            sx={{ py: 1.5, mb: 1.25 }}
          >
            Register on {event.source}
          </Button>
          <Button fullWidth variant="outlined" startIcon={<CalendarMonthIcon />} sx={{ py: 1.5, borderColor: tokens.line, color: tokens.ink }}>
            Add to calendar
          </Button>
        </Box>
      </Box>

      <TeammateDialog open={teamOpen} onClose={() => setTeamOpen(false)} event={event} />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
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
