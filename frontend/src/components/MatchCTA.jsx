import { Box, Stack, Typography, Button } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EastIcon from "@mui/icons-material/East";
import { tokens } from "../theme";

export default function MatchCTA() {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      spacing={2}
      sx={{
        background: "linear-gradient(100deg,#fff6ef,#fbe9dd)",
        border: "1px solid #f0d9c8",
        borderRadius: 4,
        p: 2.5,
        mt: 5.5,
      }}
    >
      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: tokens.accent, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <AutoAwesomeIcon fontSize="small" />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 18 }}>
          Get events matched to your resume
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 14, mt: 0.25 }}>
          Upload once — we’ll surface the events that fit your skills & goals.
        </Typography>
      </Box>
      <Button variant="contained" color="primary" endIcon={<EastIcon />}>
        Match my resume
      </Button>
    </Stack>
  );
}
