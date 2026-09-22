import { useState, useMemo } from "react";
import { Container, Box, Stack, Typography, Skeleton, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import { getEvents, searchEvents } from "../api/events";
import { tokens } from "../theme";
import Hero from "../components/Hero";
import MatchCTA from "../components/MatchCTA";
import CategoryTabs from "../components/CategoryTabs";
import EventRow from "../components/EventRow";

const CATS = [
  { key: "all", label: "All" },
  { key: "hackathon", label: "Hackathons" },
  { key: "networking", label: "Networking" },
  { key: "workshop", label: "Workshops" },
  { key: "conference", label: "Conferences" },
  { key: "startup", label: "Startup" },
];

export default function DiscoverPage() {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");
  const searchActive = query.trim().length > 0;

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
  });

  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchEvents(query),
    enabled: searchActive,
  });

  const categories = useMemo(
    () =>
      CATS.map((c) => ({
        ...c,
        count: c.key === "all" ? events.length : events.filter((e) => e.type === c.key).length,
      })),
    [events]
  );

  const filtered = active === "all" ? events : events.filter((e) => e.type === active);

  return (
    <Container maxWidth="lg">
      <Hero liveCount={events.length} onSearch={setQuery} />

      {searchActive ? (
        <Box sx={{ pb: 8 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 4, mb: 1 }}>
            <Typography sx={{ color: tokens.muted, fontSize: 14 }}>
              {searching ? "Searching…" : <>Results for <b style={{ color: tokens.ink }}>“{query}”</b> ({results.length})</>}
            </Typography>
            <Button size="small" startIcon={<CloseIcon sx={{ fontSize: 16 }} />} onClick={() => setQuery("")} sx={{ color: tokens.muted }}>
              Clear
            </Button>
          </Stack>
          {searching && [...Array(4)].map((_, i) => <RowSkeleton key={i} />)}
          {!searching && results.length === 0 && (
            <Typography sx={{ color: tokens.muted, py: 6, textAlign: "center" }}>No matching events found.</Typography>
          )}
          {!searching && results.map((e) => <EventRow key={e.id} event={e} />)}
        </Box>
      ) : (
        <>
          <MatchCTA />
          <CategoryTabs categories={categories} active={active} onChange={setActive} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2.75, mb: 0.5, flexWrap: "wrap", gap: 1 }}>
            <Typography sx={{ color: tokens.muted, fontSize: 14 }}>
              Showing <b style={{ color: tokens.ink }}>{filtered.length}</b> upcoming events in Hyderabad & online
            </Typography>
          </Stack>

          <Box sx={{ mt: 0.5, pb: 8 }}>
            {isLoading && [...Array(5)].map((_, i) => <RowSkeleton key={i} />)}
            {isError && (
              <Typography sx={{ color: tokens.muted, py: 6, textAlign: "center" }}>
                Couldn’t load events. Is the backend running on localhost:8000?
              </Typography>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <Typography sx={{ color: tokens.muted, py: 6, textAlign: "center" }}>No events in this category yet.</Typography>
            )}
            {!isLoading && filtered.map((event) => <EventRow key={event.id} event={event} />)}
          </Box>
        </>
      )}
    </Container>
  );
}

function RowSkeleton() {
  return (
    <Stack direction="row" spacing={3} sx={{ py: 2.75, px: 1, borderBottom: `1px solid ${tokens.line}` }}>
      <Skeleton variant="rounded" width={60} height={48} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width={90} height={16} />
        <Skeleton width="70%" height={28} />
        <Skeleton width={140} height={18} />
      </Box>
    </Stack>
  );
}
