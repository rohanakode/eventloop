import { Box, Container, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { tokens } from "../theme";

const linkSx = {
  fontSize: 13.5,
  color: tokens.muted,
  textDecoration: "none",
  "&:hover": { color: tokens.ink },
};

export default function Footer() {
  return (
    <Box component="footer" sx={{ mt: "auto", borderTop: `1px solid ${tokens.line}`, bgcolor: tokens.cream }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{
            py: 3,
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Typography sx={{ fontSize: 13.5, color: tokens.muted }}>
            © {new Date().getFullYear()} EventLoop · A side project by Rohan Akode
          </Typography>
          <Stack direction="row" spacing={{ xs: 2.5, sm: 3 }} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Box component={Link} to="/about" sx={linkSx}>About</Box>
            <Box component={Link} to="/legal#terms" sx={linkSx}>Terms</Box>
            <Box component={Link} to="/legal#privacy" sx={linkSx}>Privacy</Box>
            <Box component="a" href="mailto:rohanakode12@gmail.com" sx={linkSx}>Contact</Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
