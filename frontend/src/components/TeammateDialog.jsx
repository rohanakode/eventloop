import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Button, Alert,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTeammatePost } from "../api/teammates";
import { tokens } from "../theme";

export default function TeammateDialog({ open, onClose, event }) {
  const qc = useQueryClient();
  const [pitch, setPitch] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setPitch("");
      setContact("");
      setError("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: createTeammatePost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teammates"] });
      qc.invalidateQueries({ queryKey: ["teammates", "event", event?.id] });
      qc.invalidateQueries({ queryKey: ["teammates", "mine"] });
      onClose?.();
    },
  });

  const submit = () => {
    setError("");
    const p = pitch.trim();
    const c = contact.trim();
    if (p.length < 10) return setError("Say a little about yourself (at least 10 characters).");
    if (p.length > 500) return setError("Pitch must be 500 characters or fewer.");
    if (c.length < 3) return setError("Add an email or a link people can reach you at.");
    if (c.length > 200) return setError("Contact must be 200 characters or fewer.");
    mutation.mutate({ event_id: event.id, pitch: p, contact: c });
  };

  const apiError = mutation.error?.response?.data?.detail;

  return (
    <Dialog
      open={open}
      onClose={() => !mutation.isPending && onClose?.()}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, bgcolor: tokens.paper, boxShadow: tokens.shadow } }}
    >
      <DialogTitle sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 24, pt: 3.5, px: 3.5, pb: 1 }}>
        Look for teammates
      </DialogTitle>
      <DialogContent sx={{ px: 3.5, pb: 1 }}>
        <Typography sx={{ color: tokens.muted, fontSize: 14, mb: 2.5, lineHeight: 1.55 }}>
          For <b>{event?.title}</b> — everyone viewing this event will see your pitch and how to reach you.
        </Typography>
        <TextField
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          label="What you bring · what you need"
          placeholder={"e.g. React + web design, 2 hackathons under my belt. Looking for a backend/ML partner and a designer."}
          multiline
          minRows={3}
          fullWidth
          sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ maxLength: 500 }}
          helperText={`${pitch.length}/500`}
        />
        <TextField
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          label="How to reach you"
          placeholder="you@email.com  ·  github.com/you  ·  @you on twitter"
          fullWidth
          InputLabelProps={{ shrink: true }}
          inputProps={{ maxLength: 200 }}
        />
        {error && <Alert severity="warning" sx={{ mt: 2, fontSize: 13 }}>{error}</Alert>}
        {apiError && !error && <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>{typeof apiError === "string" ? apiError : "Could not post. Try again."}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={mutation.isPending} sx={{ color: tokens.muted }}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={mutation.isPending} variant="contained">
          {mutation.isPending ? "Posting…" : "Post"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
