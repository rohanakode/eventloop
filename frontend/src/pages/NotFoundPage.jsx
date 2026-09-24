import { Container, Box, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";
import { tokens } from "../theme";

export default function NotFoundPage() {
  return (
    <Container maxWidth="sm" sx={{ pt: 12, pb: 10, textAlign: "center" }}>
      <Typography
        sx={{
          fontFamily: tokens.serif,
          fontWeight: 500,
          fontSize: { xs: 84, md: 128 },
          lineHeight: 1,
          color: tokens.accent,
          mb: 2,
        }}
      >
        404
      </Typography>
      <Typography variant="h1" sx={{ fontSize: { xs: 30, md: 40 }, lineHeight: 1.05, mb: 2 }}>
        Page not found
      </Typography>
      <Typography sx={{ color: tokens.muted, fontSize: 16.5, lineHeight: 1.6, mb: 4, maxWidth: "42ch", mx: "auto" }}>
        The link might be broken, or the page moved. Head back to the events feed.
      </Typography>
      <Button component={Link} to="/" variant="contained" size="large" sx={{ px: 4, py: 1.4 }}>
        Back to Discover
      </Button>
    </Container>
  );
}
