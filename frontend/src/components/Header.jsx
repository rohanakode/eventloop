import { useState } from "react";
import { Box, Container, Button, Stack, Avatar, Menu, MenuItem, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert,
} from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { tokens } from "../theme";
import { useAuth } from "../lib/AuthProvider";
import { deleteAccount } from "../api/account";
import AuthDialog from "./AuthDialog";

const NAV = [
  { label: "Discover", to: "/" },
  { label: "For you", to: "/for-you" },
  { label: "Post event", to: "/post" },
  { label: "Teammates", to: "/teammates" },
];

export default function Header() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const runDeleteAccount = async () => {
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
      setDeleteOpen(false);
      navigate("/");
    } catch (err) {
      setDeleteError(err?.response?.data?.detail || "Could not delete your account. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const displayName = user?.user_metadata?.name || "";
  const initials = (
    displayName
      ? displayName.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2)
      : (user?.email || "?").slice(0, 2)
  ).toUpperCase();

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

          {user ? (
            <>
              <Box
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  py: 0.5,
                  px: 0.75,
                  borderRadius: 100,
                  border: `1px solid ${tokens.line}`,
                  "&:hover": { borderColor: "#d8cdb8", bgcolor: tokens.paper },
                }}
              >
                <Avatar sx={{ width: 30, height: 30, bgcolor: tokens.accent, color: "#fff", fontSize: 12, fontWeight: 600 }}>
                  {initials}
                </Avatar>
              </Box>
              <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                PaperProps={{ sx: { mt: 1, borderRadius: 3, minWidth: 220, border: `1px solid ${tokens.line}`, boxShadow: tokens.shadow } }}
              >
                <Box sx={{ px: 2, py: 1.25 }}>
                  <Box sx={{ fontSize: 11, fontWeight: 600, color: tokens.muted, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                    Signed in as
                  </Box>
                  {displayName && (
                    <Box sx={{ fontSize: 14, fontWeight: 600, color: tokens.ink, mt: 0.4 }}>
                      {displayName}
                    </Box>
                  )}
                  <Box sx={{ fontSize: 12.5, color: displayName ? tokens.muted : tokens.ink, mt: 0.25, wordBreak: "break-all" }}>
                    {user.email}
                  </Box>
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem component={Link} to="/post" onClick={() => setAnchor(null)} sx={{ fontSize: 14 }}>
                  My posted events
                </MenuItem>
                <MenuItem onClick={async () => { setAnchor(null); await signOut(); }} sx={{ fontSize: 14 }}>
                  Sign out
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={() => { setAnchor(null); setDeleteError(""); setDeleteOpen(true); }}
                  sx={{ fontSize: 14, color: "#c94f4f", "&:hover": { bgcolor: "#fce9e9" } }}
                >
                  Delete account
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={() => setAuthOpen(true)}
              sx={{ bgcolor: tokens.ink, flexShrink: 0, "&:hover": { bgcolor: "#000" } }}
            >
              Sign in
            </Button>
          )}
        </Box>
      </Container>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />

      <Dialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, bgcolor: tokens.paper, boxShadow: tokens.shadow } }}
      >
        <DialogTitle sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 22, pt: 3.5, px: 3.5, pb: 1 }}>
          Delete your account?
        </DialogTitle>
        <DialogContent sx={{ px: 3.5, pb: 1 }}>
          <Typography sx={{ color: tokens.muted, fontSize: 14.5, lineHeight: 1.55, mb: 2 }}>
            This will permanently remove your <b>{user?.email}</b> account and every event you've posted. It can't be undone.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ fontSize: 13 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting} sx={{ color: tokens.muted }}>
            Cancel
          </Button>
          <Button
            onClick={runDeleteAccount}
            disabled={deleting}
            variant="contained"
            sx={{ bgcolor: "#c94f4f", "&:hover": { bgcolor: "#a93c3c" } }}
          >
            {deleting ? "Deleting…" : "Delete forever"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
