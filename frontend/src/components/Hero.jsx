import { useState } from "react";
import { Box, Typography, Stack, InputBase, Button } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { tokens } from "../theme";

export default function Hero({ liveCount, onSearch }) {
  const [text, setText] = useState("");
  const submit = () => onSearch(text.trim());
  return (
    <Box sx={{ pt: 7.5, pb: 2.5 }}>
      {/* eyebrow */}
      <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2.5 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tokens.accent, boxShadow: `0 0 0 4px ${tokens.accentSoft}` }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.accentDark, letterSpacing: "0.4px", textTransform: "uppercase" }}>
          {liveCount} events live · Hyderabad
        </Typography>
      </Stack>

      <Typography variant="h1" sx={{ fontSize: { xs: 42, md: 58 }, lineHeight: 1.02, maxWidth: "14ch" }}>
        Where Hyderabad builds{" "}
        <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>
          what’s next.
        </Box>
      </Typography>

      <Typography sx={{ color: tokens.muted, fontSize: 18, mt: 2.5, maxWidth: "46ch", lineHeight: 1.6 }}>
        Every hackathon, meetup, and startup night worth your time — gathered from across the web and matched to your goals.
      </Typography>

      {/* Search */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{
          bgcolor: tokens.paper,
          border: `1px solid ${tokens.line}`,
          borderRadius: 100,
          pl: 2.75,
          pr: 1,
          py: 1,
          maxWidth: 520,
          mt: 3.5,
          boxShadow: tokens.shadow,
        }}
      >
        <SearchIcon sx={{ color: "#c3bbac" }} />
        <InputBase
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Search “AI hackathons”, “startup networking”…"
          sx={{ flex: 1, fontSize: 15 }}
        />
        <Button variant="contained" color="primary" onClick={submit}>
          Search
        </Button>
      </Stack>
    </Box>
  );
}
