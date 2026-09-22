import { Box, Container, Button, Stack } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { tokens } from "../theme";

const NAV = [
  { label: "Discover", to: "/" },
  { label: "For you", to: "/for-you" },
  { label: "Post event", to: "/" },
  { label: "Teammates", to: "/" },
];

export default function Header() {
  const { pathname } = useLocation();
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        bgcolor: "rgba(245,241,232,0.82)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${tokens.line}`,
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", height: 70 }}>
          {/* Logo */}
          <Box component={Link} to="/" sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                bgcolor: tokens.accent,
                position: "relative",
                "&::after": { content: '""', position: "absolute", inset: "8px", borderRadius: "50%", bgcolor: tokens.cream },
              }}
            />
            <Box sx={{ fontFamily: tokens.serif, fontWeight: 900, fontSize: 22, letterSpacing: "-0.5px", color: tokens.ink }}>
              EventLoop
            </Box>
          </Box>

          {/* Nav (center-right) */}
          <Stack direction="row" spacing={4} sx={{ display: { xs: "none", md: "flex" }, ml: "auto", mr: 4 }}>
            {NAV.map((item) => {
              const active = pathname === item.to || (item.to === "/" && pathname === "/");
              return (
                <Box
                  key={item.label}
                  component={Link}
                  to={item.to}
                  sx={{
                    fontSize: 14.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? tokens.ink : tokens.muted,
                    "&:hover": { color: tokens.ink },
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Stack>

          <Button variant="contained" sx={{ bgcolor: tokens.ink, flexShrink: 0, "&:hover": { bgcolor: "#000" } }}>
            Sign in
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
