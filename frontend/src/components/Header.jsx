import { useState } from "react";
import { Box, Container, Button, Stack, Avatar, Menu, MenuItem, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert,
  IconButton, Drawer,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { tokens } from "../theme";
import { useAuth } from "../lib/AuthProvider";
import { useToast } from "../lib/Toast";
import { deleteAccount } from "../api/account";
import AuthDialog from "./AuthDialog";

const NAV = [
  { label: "Discover", to: "/" },
  { label: "For you", to: "/for-you" },
  { label: "Post event", to: "/post" },
  { label: "Teammates", to: "/teammates" },
  { label: "About", to: "/about" },
];

export default function Header() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();

  const doSignOut = async () => {
    await signOut();
    showToast("Signed out.");
  };
  const [authOpen, setAuthOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      showToast("Account deleted.", "info");
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

          <Stack direction="row" spacing={{ md: 3, lg: 4 }} sx={{ display: { xs: "none", md: "flex" }, ml: "auto", mr: 4 }}>
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

          {/* Hamburger — only on xs / sm */}
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { xs: "inline-flex", md: "none" }, ml: "auto", color: tokens.ink }}
            aria-label="Open menu"
          >
            <MenuIcon />
          </IconButton>

          {user ? (
            <>
              <Box
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                  cursor: "pointer",
                  display: { xs: "none", md: "flex" },
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
                autoFocus={false}
                disableAutoFocusItem
                MenuListProps={{ autoFocusItem: false, disableListWrap: true }}
                PaperProps={{ sx: { mt: 1, borderRadius: 3, minWidth: 220, border: `1px solid ${tokens.line}`, boxShadow: tokens.shadow } }}
                sx={{
                  "& .MuiMenuItem-root": {
                    "&.Mui-focusVisible, &:focus": { bgcolor: "transparent" },
                    "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
                  },
                }}
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
                <MenuItem onClick={async () => { setAnchor(null); await doSignOut(); }} sx={{ fontSize: 14 }}>
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
              sx={{ bgcolor: tokens.ink, flexShrink: 0, display: { xs: "none", md: "inline-flex" }, "&:hover": { bgcolor: "#000" } }}
            >
              Sign in
            </Button>
          )}
        </Box>
      </Container>
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: "min(320px, 82vw)", bgcolor: tokens.cream, borderLeft: `1px solid ${tokens.line}`, boxShadow: tokens.shadow } }}
      >
        <Stack sx={{ height: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 70, px: 2.5, borderBottom: `1px solid ${tokens.line}` }}>
            <Box sx={{ fontFamily: tokens.serif, fontWeight: 900, fontSize: 20, color: tokens.ink }}>Menu</Box>
            <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: tokens.muted }} aria-label="Close menu">
              <CloseIcon />
            </IconButton>
          </Box>

          {user && (
            <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${tokens.line}`, display: "flex", alignItems: "center", gap: 1.25 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: tokens.accent, color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {initials}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                {displayName && (
                  <Box sx={{ fontSize: 14, fontWeight: 600, color: tokens.ink, lineHeight: 1.2 }}>{displayName}</Box>
                )}
                <Box sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.25, wordBreak: "break-all" }}>{user.email}</Box>
              </Box>
            </Box>
          )}

          <Stack sx={{ py: 1.5 }}>
            {NAV.map((item) => {
              const active = pathname === item.to || (item.to === "/" && pathname === "/");
              return (
                <Box
                  key={item.label}
                  component={Link}
                  to={item.to}
                  onClick={() => setDrawerOpen(false)}
                  sx={{
                    px: 2.5,
                    py: 1.4,
                    fontSize: 16,
                    fontWeight: active ? 600 : 500,
                    color: active ? tokens.ink : tokens.muted,
                    textDecoration: "none",
                    "&:hover": { color: tokens.ink, bgcolor: tokens.paper },
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Stack>

          <Box sx={{ mt: "auto", px: 2.5, py: 2.5, borderTop: `1px solid ${tokens.line}` }}>
            {user ? (
              <Stack spacing={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={async () => { setDrawerOpen(false); await doSignOut(); }}
                  sx={{ borderColor: tokens.line, color: tokens.ink }}
                >
                  Sign out
                </Button>
                <Button
                  fullWidth
                  onClick={() => { setDrawerOpen(false); setDeleteError(""); setDeleteOpen(true); }}
                  sx={{ color: "#c94f4f" }}
                >
                  Delete account
                </Button>
              </Stack>
            ) : (
              <Button
                fullWidth
                variant="contained"
                onClick={() => { setDrawerOpen(false); setAuthOpen(true); }}
                sx={{ bgcolor: tokens.ink, "&:hover": { bgcolor: "#000" } }}
              >
                Sign in
              </Button>
            )}
          </Box>
        </Stack>
      </Drawer>

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
            This will permanently remove your <b>{user?.email}</b> account, every event you've posted, and every teammate post you've made. It can't be undone.
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
