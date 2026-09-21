import { Box, Stack, Typography } from "@mui/material";
import EastIcon from "@mui/icons-material/East";
import PublicIcon from "@mui/icons-material/Public";
import PlaceIcon from "@mui/icons-material/Place";
import { useNavigate } from "react-router-dom";
import { tokens } from "../theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return { day: String(d).padStart(2, "0"), mon: MONTHS[m - 1] };
}

export default function EventRow({ event }) {
  const navigate = useNavigate();
  const { day, mon } = parseDate(event.date);
  const dotColor = tokens.category[event.type] || tokens.muted;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={3}
      onClick={() => navigate(`/events/${event.id}`)}
      sx={{
        py: 2.75,
        px: 1,
        borderBottom: `1px solid ${tokens.line}`,
        borderRadius: 2,
        cursor: "pointer",
        transition: ".15s",
        "&:hover": { bgcolor: tokens.paper, px: 2.25 },
        "&:hover .rego": { gap: "10px" },
      }}
    >
      {/* Date tile */}
      <Box sx={{ textAlign: "center", borderRight: `1px solid ${tokens.line}`, pr: 2.75, minWidth: 76 }}>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 30, lineHeight: 1 }}>{day}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: tokens.muted, mt: 0.5 }}>
          {mon}
        </Typography>
      </Box>

      {/* Middle */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.9 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: dotColor }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {event.type}
          </Typography>
        </Stack>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 20, lineHeight: 1.25, mb: 1 }}>
          {event.title}
        </Typography>
        <Stack direction="row" spacing={2.25} sx={{ color: tokens.muted, fontSize: 14, fontWeight: 500 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {event.online ? <PublicIcon sx={{ fontSize: 16 }} /> : <PlaceIcon sx={{ fontSize: 16 }} />}
            <span>{event.online ? "Online" : event.city || "—"}</span>
          </Stack>
        </Stack>
      </Box>

      {/* Right */}
      <Stack alignItems="flex-end" spacing={1.25} sx={{ display: { xs: "none", sm: "flex" } }}>
        <Box
          component="a"
          href={event.source_url || "#"}
          target="_blank"
          rel="noreferrer"
          className="rego"
          onClick={(e) => e.stopPropagation()}
          sx={{ fontWeight: 600, fontSize: 14, color: tokens.accentDark, display: "flex", alignItems: "center", gap: "6px", transition: ".15s" }}
        >
          Register <EastIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ fontSize: 12, color: "#b3ab9c", fontWeight: 500 }}>via {event.source}</Typography>
      </Stack>
    </Stack>
  );
}
