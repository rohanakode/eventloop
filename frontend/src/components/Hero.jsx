import { useState } from "react";
import { Box, Typography, InputBase, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { tokens } from "../theme";

export default function Hero({ value, onSearch }) {
  // Controlled if a `value` prop is passed (from the parent), otherwise
  // fall back to internal state for standalone use.
  const [internal, setInternal] = useState("");
  const text = value !== undefined ? value : internal;
  const change = (v) => {
    if (value === undefined) setInternal(v);
    onSearch(v);
  };
  const clear = () => change("");
  return (
    <Box sx={{ pt: 7.5, pb: 2.5, textAlign: "center" }}>
      <Typography variant="h1" sx={{ fontSize: { xs: 42, md: 64, lg: 72 }, lineHeight: 1.02, maxWidth: "30ch", mx: "auto" }}>
        Hyderabad's tech events,{" "}
        <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>
          in one place.
        </Box>
      </Typography>

      <Typography sx={{ color: tokens.muted, fontSize: { xs: 17, md: 19 }, mt: 2.5, maxWidth: "68ch", mx: "auto", lineHeight: 1.6 }}>
        Hackathons, meetups, workshops, startup nights. Aggregated from multiple sources, plus events community hosts post themselves.
      </Typography>

      {/* Search */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          bgcolor: tokens.paper,
          border: `1px solid ${tokens.line}`,
          borderRadius: 100,
          pl: 2.25,
          pr: 0.75,
          height: 52,
          width: "100%",
          maxWidth: 640,
          mt: 4,
          mx: "auto",
          boxShadow: tokens.shadow,
          gap: 1,
        }}
      >
        <SearchIcon sx={{ color: "#c3bbac", fontSize: 20, flexShrink: 0 }} />
        <InputBase
          value={text}
          onChange={(e) => change(e.target.value)}
          placeholder="Search “AI hackathons”…"
          sx={{
            flex: 1,
            fontSize: 14.5,
            minWidth: 0,
            height: "100%",
            "& input": { p: 0, height: "100%" },
          }}
        />
        {text && (
          <IconButton
            onClick={clear}
            aria-label="Clear search"
            sx={{ color: tokens.muted, flexShrink: 0, "&:hover": { color: tokens.ink } }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
