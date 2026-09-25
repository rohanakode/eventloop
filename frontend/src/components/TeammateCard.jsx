import { Box, Stack, Typography, IconButton } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import LaunchIcon from "@mui/icons-material/Launch";
import { Link as RouterLink } from "react-router-dom";
import { tileFor } from "../lib/dateTile";
import { tokens } from "../theme";

// Turn a contact string (email OR url OR handle) into a clickable link.
function contactHref(contact) {
  if (!contact) return null;
  const c = contact.trim();
  if (/^https?:\/\//i.test(c)) return c;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return `mailto:${c}`;
  return null;
}

// Renders one teammate-interest row. Toggle `showEvent` off in event-scoped
// contexts (the event page already shows the event above).
export default function TeammateCard({ post, showEvent = true, onDelete, canDelete = false }) {
  const { day, mon } = tileFor(post.event_date);
  const catColor = tokens.category[post.event_type] || tokens.muted;
  const href = contactHref(post.contact);

  return (
    <Box
      sx={{
        bgcolor: tokens.paper,
        border: `1px solid ${tokens.line}`,
        borderRadius: 3,
        p: 2.5,
        boxShadow: "0 1px 2px rgba(60,40,20,.03)",
        transition: ".15s",
        "&:hover": { borderColor: "#d8cdb8", boxShadow: tokens.shadow },
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ sm: "flex-start" }}>
        {showEvent && (
          <Box sx={{ textAlign: "center", minWidth: 60, borderRight: { sm: `1px solid ${tokens.line}` }, pr: { sm: 2.5 }, pb: { xs: 1.5, sm: 0 } }}>
            <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 24, lineHeight: 1 }}>{day}</Typography>
            <Typography sx={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: tokens.muted, mt: 0.4 }}>{mon}</Typography>
          </Box>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {showEvent && (
            <Box
              component={RouterLink}
              to={`/events/${post.event_id}`}
              sx={{ textDecoration: "none", color: "inherit", display: "inline-block", mb: 0.75 }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: catColor, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: 1 }}>
                  {post.event_type}
                </Typography>
              </Stack>
              <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 17, lineHeight: 1.25, "&:hover": { color: tokens.accent } }}>
                {post.event_title}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.25 }}>
                {post.event_online ? "Online" : (post.event_city || "—")}
              </Typography>
            </Box>
          )}

          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: tokens.muted, mt: showEvent ? 1.75 : 0, mb: 0.5 }}>
            {post.user_name || "Someone"} is looking for teammates
          </Typography>
          <Typography sx={{ fontSize: 14.5, color: tokens.ink, lineHeight: 1.55, mb: 1.5, whiteSpace: "pre-wrap" }}>
            {post.pitch}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ color: tokens.muted, fontSize: 13 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 12.5, color: tokens.muted }}>Reach them:</Typography>
            {href ? (
              <Box
                component="a"
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                sx={{ color: tokens.accent, fontWeight: 500, fontSize: 13.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5, "&:hover": { textDecoration: "underline" } }}
              >
                {post.contact}
                <LaunchIcon sx={{ fontSize: 13 }} />
              </Box>
            ) : (
              <Typography sx={{ fontSize: 13.5, color: tokens.ink, fontWeight: 500 }}>{post.contact}</Typography>
            )}
          </Stack>
        </Box>

        {canDelete && (
          <IconButton
            onClick={() => onDelete?.(post)}
            sx={{ color: tokens.muted, alignSelf: "flex-start", "&:hover": { color: "#c94f4f", bgcolor: "#fce9e9" } }}
            title="Withdraw"
          >
            <DeleteOutlineIcon />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}
