import { useMemo, useState } from "react";
import { Container, Box, Stack, Typography, CircularProgress } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteTeammatePost, getTeammates } from "../api/teammates";
import TeammateCard from "../components/TeammateCard";
import { useAuth } from "../lib/AuthProvider";
import { tokens } from "../theme";

const CATEGORIES = [
  { key: null,            label: "All" },
  { key: "hackathon",     label: "Hackathons" },
  { key: "startup",       label: "Startup" },
  { key: "workshop",      label: "Workshops" },
  { key: "conference",    label: "Conferences" },
  { key: "networking",    label: "Networking" },
  { key: "communication", label: "Communication" },
];

export default function TeammatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [type, setType] = useState(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["teammates", { type }],
    queryFn: () => getTeammates({ type }),
  });

  const withdraw = useMutation({
    mutationFn: deleteTeammatePost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teammates"] });
    },
  });

  // Group by event so each hackathon is a section.
  const grouped = useMemo(() => {
    const byEvent = new Map();
    for (const p of posts) {
      if (!byEvent.has(p.event_id)) byEvent.set(p.event_id, { event: p, posts: [] });
      byEvent.get(p.event_id).posts.push(p);
    }
    return Array.from(byEvent.values());
  }, [posts]);

  return (
    <Container maxWidth="md" sx={{ pb: 10 }}>
      {/* Hero */}
      <Box sx={{ pt: 7, pb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2.5 }}>
          <GroupsIcon sx={{ color: tokens.accent, fontSize: 20 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.accentDark, letterSpacing: "0.4px", textTransform: "uppercase" }}>
            Teammates
          </Typography>
        </Stack>
        <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 56 }, lineHeight: 1.02, maxWidth: "16ch" }}>
          Build with{" "}
          <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>
            people who fit.
          </Box>
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 18, mt: 2.5, maxWidth: "48ch", lineHeight: 1.6 }}>
          Everyone looking for teammates across every event on EventLoop. Skim the pitches, reach out directly.
        </Typography>
      </Box>

      {/* Category filter */}
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 4 }}>
        {CATEGORIES.map((c) => {
          const active = type === c.key;
          return (
            <Box
              key={c.label}
              onClick={() => setType(c.key)}
              sx={{
                cursor: "pointer",
                px: 2,
                py: 0.85,
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 600,
                border: `1.5px solid ${active ? tokens.accent : tokens.line}`,
                bgcolor: active ? tokens.accentSoft : "transparent",
                color: active ? tokens.accentDark : tokens.muted,
                transition: ".15s",
                "&:hover": { borderColor: tokens.accent, color: tokens.ink },
              }}
            >
              {c.label}
            </Box>
          );
        })}
      </Stack>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <CircularProgress sx={{ color: tokens.accent }} />
        </Box>
      ) : grouped.length === 0 ? (
        <Box
          sx={{
            py: { xs: 7, md: 9 },
            px: 3,
            textAlign: "center",
            border: `1.5px dashed ${tokens.line}`,
            borderRadius: 4,
            bgcolor: tokens.paper,
          }}
        >
          <Typography sx={{ fontFamily: tokens.serif, fontSize: 24, mb: 1 }}>
            No teammates{" "}
            <Box component="em" sx={{ fontStyle: "italic", color: tokens.accent }}>listed yet.</Box>
          </Typography>
          <Typography sx={{ color: tokens.muted, maxWidth: "40ch", mx: "auto" }}>
            Head to a hackathon or event page and be the first to say you're looking.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={5}>
          {grouped.map(({ event, posts }) => (
            <Box key={event.event_id}>
              <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 2 }}>
                <Typography variant="h2" sx={{ fontSize: 24 }}>{event.event_title}</Typography>
                <Typography sx={{ color: tokens.muted, fontSize: 14 }}>
                  {posts.length} looking
                </Typography>
              </Stack>
              <Stack spacing={2}>
                {posts.map((p) => (
                  <TeammateCard
                    key={p.id}
                    post={p}
                    showEvent={false}
                    canDelete={user?.id === p.user_id}
                    onDelete={() => withdraw.mutate(p.id)}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Container>
  );
}
