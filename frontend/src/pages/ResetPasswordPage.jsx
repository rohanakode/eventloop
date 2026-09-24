import { useEffect, useState } from "react";
import { Container, Box, Stack, Typography, TextField, Button, Alert, CircularProgress } from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { tokens } from "../theme";

// Handles Supabase's password reset callback. The reset-link email contains
// a token that Supabase JS picks up automatically from the URL hash on load
// and turns into a temporary "recovery" session. From there we let the user
// set a new password via `updateUser`.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Wait until the recovery session lands from the URL hash.
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If we're already signed in (or Supabase already parsed the hash by the
    // time this effect ran), skip the wait.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== password2) { setError("Passwords don't match."); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    // Sign out the recovery session so the user comes back in freshly.
    await supabase.auth.signOut();
    setTimeout(() => navigate("/"), 1200);
  };

  if (!ready) {
    return (
      <Container maxWidth="sm" sx={{ pt: 14, textAlign: "center" }}>
        <CircularProgress sx={{ color: tokens.accent }} />
        <Typography sx={{ color: tokens.muted, mt: 2 }}>Verifying reset link…</Typography>
      </Container>
    );
  }

  if (done) {
    return (
      <Container maxWidth="sm" sx={{ pt: 12, textAlign: "center" }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 34, md: 42 }, mb: 2 }}>
          You're all set.
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 16 }}>
          Redirecting you to the home page. Sign in with your new password.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ pt: 10, pb: 10 }}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Box sx={{ width: 60, height: 60, borderRadius: "50%", bgcolor: tokens.accentSoft, color: tokens.accent, display: "grid", placeItems: "center", mx: "auto", mb: 3 }}>
          <LockResetIcon sx={{ fontSize: 28 }} />
        </Box>
        <Typography variant="h1" sx={{ fontSize: { xs: 32, md: 40 }, lineHeight: 1.05, mb: 1.5 }}>
          Set a new password
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 15.5 }}>
          At least 6 characters. Don't reuse an old one.
        </Typography>
      </Box>

      <Stack spacing={2}>
        <TextField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          label="New password"
          type="password"
          fullWidth
          autoFocus
          InputLabelProps={{ shrink: true }}
          inputProps={{ maxLength: 200 }}
        />
        <TextField
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          label="Confirm new password"
          type="password"
          fullWidth
          InputLabelProps={{ shrink: true }}
          inputProps={{ maxLength: 200 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <Alert severity="error" sx={{ fontSize: 13 }}>{error}</Alert>}
        <Button variant="contained" size="large" onClick={submit} disabled={busy} sx={{ py: 1.4, fontSize: 15 }}>
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </Stack>
    </Container>
  );
}
