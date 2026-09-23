import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, Box, Stack, Typography, TextField, Button, Alert,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthProvider";
import { tokens } from "../theme";

export default function AuthDialog({ open, onClose, initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode); // "signin" | "signup" | "reset"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Wipe the form every time the dialog closes so it never opens pre-filled.
  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setPassword("");
      setError("");
      setResetSent(false);
      setMode(initialMode);
    }
  }, [open, initialMode]);

  const submit = async () => {
    setError("");

    // Password reset: only needs an email.
    if (mode === "reset") {
      if (!email) { setError("Enter the email you signed up with."); return; }
      setBusy(true);
      const { error: err } = await resetPassword(email);
      setBusy(false);
      if (err) { setError(err.message); return; }
      setResetSent(true);
      return;
    }

    if (!email || !password || (mode === "signup" && !name.trim())) {
      setError(mode === "signup" ? "Enter your name, email and a password." : "Enter an email and password.");
      return;
    }
    if (mode === "signup") {
      const cleanName = name.trim();
      if (cleanName.length > 60) { setError("Name must be 60 characters or fewer."); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    }
    setBusy(true);
    const result = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, name.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    // Signup with confirmation on → session is null → quietly flip to sign-in.
    if (mode === "signup" && !result.data?.session) {
      setMode("signin");
      return;
    }
    // Signed in (or auto-signed-in after signup) → drop them on the home page
    // so they choose what to do next, instead of landing mid-form.
    onClose?.();
    navigate("/");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, bgcolor: tokens.paper, boxShadow: tokens.shadow, overflow: "hidden" } }}
    >
      <DialogContent sx={{ p: { xs: 3.5, md: 4.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <AutoAwesomeIcon sx={{ color: tokens.accent, fontSize: 18 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.accentDark, letterSpacing: "0.4px", textTransform: "uppercase" }}>
              {mode === "signin" ? "Welcome back" : mode === "signup" ? "New here" : "Reset password"}
            </Typography>
          </Stack>
          <Box onClick={onClose} sx={{ cursor: "pointer", color: tokens.muted, "&:hover": { color: tokens.ink } }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </Box>
        </Stack>

        <Typography variant="h1" sx={{ fontSize: 30, lineHeight: 1.05, mb: 1 }}>
          {mode === "signin" && <>Sign in to <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>EventLoop.</Box></>}
          {mode === "signup" && <>Create your <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>account.</Box></>}
          {mode === "reset" && <>Forgot your <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>password?</Box></>}
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 14.5, mb: 3.5, lineHeight: 1.55 }}>
          {mode === "reset"
            ? "Enter your email and we'll send you a link to set a new one."
            : "Post events and see the ones you've hosted."}
        </Typography>

        {mode === "reset" && resetSent ? (
          <Stack spacing={2}>
            <Alert severity="success" sx={{ fontSize: 13 }}>
              If an account exists for <b>{email}</b>, a reset link is on its way. Check your inbox.
            </Alert>
            <Button
              variant="outlined"
              onClick={() => { setResetSent(false); setMode("signin"); }}
              sx={{ py: 1.35, fontSize: 14.5 }}
            >
              Back to sign in
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {mode === "signup" && (
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                label="Your name"
                fullWidth
                autoFocus
                InputLabelProps={{ shrink: true }}
                inputProps={{ maxLength: 60 }}
              />
            )}
            <TextField
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              label="Email"
              type="email"
              fullWidth
              autoFocus={mode !== "signup"}
              autoComplete={mode === "signin" ? "email" : "off"}
              InputLabelProps={{ shrink: true }}
              onKeyDown={(e) => e.key === "Enter" && mode === "reset" && submit()}
            />
            {mode !== "reset" && (
              <TextField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                label="Password"
                type="password"
                fullWidth
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                InputLabelProps={{ shrink: true }}
                inputProps={{ maxLength: 200 }}
                helperText={mode === "signup" ? "At least 6 characters." : undefined}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            )}
            {mode === "signin" && (
              <Box sx={{ textAlign: "right", mt: -0.5 }}>
                <Box
                  component="span"
                  onClick={() => { setError(""); setMode("reset"); }}
                  sx={{ fontSize: 13, color: tokens.accent, fontWeight: 500, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                >
                  Forgot password?
                </Box>
              </Box>
            )}
            {error && <Alert severity="error" sx={{ fontSize: 13 }}>{error}</Alert>}
            <Button
              variant="contained"
              size="large"
              disabled={busy}
              onClick={submit}
              sx={{ mt: 0.5, py: 1.35, fontSize: 15 }}
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </Stack>
        )}

        {!resetSent && (
          <Typography sx={{ textAlign: "center", mt: 3, fontSize: 13.5, color: tokens.muted }}>
            {mode === "reset" ? (
              <>Remembered it? <Box component="span" onClick={() => { setError(""); setMode("signin"); }} sx={{ color: tokens.accent, fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>Sign in</Box></>
            ) : (
              <>
                {mode === "signin" ? "New here? " : "Have an account? "}
                <Box
                  component="span"
                  onClick={() => { setError(""); setMode(mode === "signin" ? "signup" : "signin"); }}
                  sx={{ color: tokens.accent, fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                >
                  {mode === "signin" ? "Create an account" : "Sign in instead"}
                </Box>
              </>
            )}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
