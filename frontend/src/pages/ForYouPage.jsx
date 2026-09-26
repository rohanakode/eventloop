import { useState, useRef } from "react";
import {
  Container, Box, Stack, Typography, Button, Chip, LinearProgress, Alert,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckIcon from "@mui/icons-material/Check";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { matchResume } from "../api/events";
import { useToast } from "../lib/Toast";
import { tileFor } from "../lib/dateTile";
import { tokens } from "../theme";

const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export default function ForYouPage() {
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);
  const showToast = useToast();

  const mutation = useMutation({
    mutationFn: matchResume,
    onSuccess: (data) => {
      const count = (data?.matches || []).length;
      if (count > 0) {
        showToast(`Matched to ${count} event${count === 1 ? "" : "s"}.`, "sparkle");
      } else {
        showToast("No strong matches yet - check back as more events get added.", "info");
      }
    },
    onError: (err) =>
      showToast(
        err?.response?.data?.detail || "Couldn't read the resume. Try a different PDF.",
        "error",
      ),
  });
  const result = mutation.data;

  const onFile = (f) => {
    if (!f) return;
    // Resumes only - reject anything that isn't a PDF, with visible feedback
    // (the drag-drop path can hand us any file type, bypassing the input's accept).
    const isPdf =
      f.name.toLowerCase().endsWith(".pdf") &&
      (!f.type || f.type === "application/pdf");
    if (!isPdf) {
      showToast("Only PDF resumes are accepted. Please upload a .pdf file.", "error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (f.size > MAX_BYTES) {
      showToast(`That file is too large. Max ${MAX_MB} MB.`, "error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
    mutation.reset();
    // Kick off the match immediately - no button click needed.
    mutation.mutate({ file: f });
  };
  const reset = () => {
    setFile(null);
    mutation.reset();
    if (inputRef.current) inputRef.current.value = "";
  };
  // Clear the failed attempt and immediately open the picker to try again.
  const chooseAnother = () => {
    reset();
    inputRef.current?.click();
  };

  return (
    <Container maxWidth="md" sx={{ pb: 10 }}>
      {/* Hero */}
      <Box sx={{ pt: 7, pb: 4, textAlign: "center" }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 58 }, lineHeight: 1.02, maxWidth: "20ch", mx: "auto" }}>
          Skip the events that aren't for you.
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 18, mt: 2.5, maxWidth: "50ch", mx: "auto", lineHeight: 1.6 }}>
          Drop your resume. It reads like a recruiter would and pushes the events that fit you to the top.
        </Typography>
      </Box>

      {/* Dropzone */}
      <DropZone
        file={file}
        isError={mutation.isError}
        onClear={reset}
        onFile={onFile}
        onOpen={() => inputRef.current?.click()}
      />
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {mutation.isPending && (
        <Stack alignItems="center" sx={{ mt: 3.5 }}>
          <LinearProgress sx={{ width: "100%", maxWidth: 320, borderRadius: 100, "& .MuiLinearProgress-bar": { bgcolor: tokens.accent } }} />
          <Typography sx={{ fontSize: 13, color: tokens.muted, mt: 1.5 }}>
            Reading your resume…
          </Typography>
        </Stack>
      )}
      {file && !result && !mutation.isPending && !mutation.isError && (
        <Typography component="span" sx={{ fontSize: 12.5, color: tokens.muted, mt: 2.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75 }}>
          <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
          Processed in memory. Never stored.
        </Typography>
      )}
      {mutation.isError && (
        <Stack alignItems="center" spacing={2} sx={{ mt: 3 }}>
          <Alert severity="error" sx={{ width: "100%" }}>
            {mutation.error?.response?.data?.detail || "Something went wrong. Try again."}
          </Alert>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={chooseAnother}
            sx={{ bgcolor: tokens.accent, "&:hover": { bgcolor: tokens.accentDark } }}
          >
            Choose a different file
          </Button>
        </Stack>
      )}

      {result && <Results result={result} onReset={reset} />}
    </Container>
  );
}

/* ---------- Sub-components ---------- */

function DropZone({ file, isError, onFile, onClear, onOpen }) {
  const [hover, setHover] = useState(false);
  // A file that's selected but errored should still be re-openable by click.
  const locked = file && !isError;
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); onFile(e.dataTransfer.files?.[0]); }}
      onClick={locked ? undefined : onOpen}
      sx={{
        minHeight: 220,
        border: `2px dashed ${isError ? "#e0a3a3" : hover ? tokens.accent : "#d8cdb8"}`,
        borderRadius: 4,
        bgcolor: isError ? "#fdf3f3" : hover ? "#faf1e8" : tokens.paper,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: locked ? "default" : "pointer",
        transition: ".18s",
        px: 3,
        boxShadow: tokens.shadow,
        "&:hover": locked ? {} : { borderColor: isError ? "#c94f4f" : tokens.accent, bgcolor: isError ? "#fbeaea" : "#faf1e8" },
      }}
    >
      {file && isError ? (
        <Stack alignItems="center" spacing={1.5}>
          <Box sx={{ width: 54, height: 54, borderRadius: 2, bgcolor: "#fce9e9", color: "#c94f4f", display: "grid", placeItems: "center" }}>
            <ErrorOutlineIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 18 }}>{file.name}</Typography>
          <Typography sx={{ fontSize: 13, color: "#c94f4f" }}>Couldn't use this file - click to choose another</Typography>
        </Stack>
      ) : file ? (
        <Stack alignItems="center" spacing={1.5}>
          <Box sx={{ width: 54, height: 54, borderRadius: 2, bgcolor: tokens.accentSoft, color: tokens.accentDark, display: "grid", placeItems: "center" }}>
            <CheckIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 18 }}>{file.name}</Typography>
          <Typography sx={{ fontSize: 13, color: tokens.muted }}>{(file.size / 1024).toFixed(0)} KB</Typography>
        </Stack>
      ) : (
        <Stack alignItems="center" spacing={1.5}>
          <Box sx={{ width: 54, height: 54, borderRadius: 2, bgcolor: tokens.accent, color: "#fff", display: "grid", placeItems: "center" }}>
            <UploadFileIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 20 }}>Drop your resume here</Typography>
          <Typography sx={{ fontSize: 14, color: tokens.muted, textAlign: "center" }}>
            or click to browse · PDF up to 5&nbsp;MB
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

const CATEGORY_LABEL = {
  hackathon: "Hackathons for you",
  startup: "Startup events for you",
  workshop: "Workshops for you",
  conference: "Conferences for you",
  networking: "Networking events for you",
  communication: "Communication events for you",
};

function Results({ result, onReset }) {
  const { profile, groups = [], matches = [] } = result;

  return (
    <>
      {/* Profile summary */}
      <Box sx={{ mt: 6, textAlign: "center" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: tokens.muted, mb: 1.5 }}>
          What we understood from your resume
        </Typography>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: { xs: 22, md: 26 }, lineHeight: 1.3 }}>
          You look like a{" "}
          <Box component="span" sx={{ color: tokens.accent, fontStyle: "italic" }}>
            {profile.headline || "professional"}
          </Box>
        </Typography>
        {(profile.skills?.length || profile.interests?.length) > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center" sx={{ mt: 2.5 }}>
            {[...(profile.skills || []), ...(profile.interests || [])].slice(0, 12).map((t) => (
              <Chip key={t} label={t} size="small" sx={{ bgcolor: tokens.paper, border: `1px solid ${tokens.line}`, color: tokens.ink, fontWeight: 500 }} />
            ))}
          </Stack>
        )}
        <Button size="small" onClick={onReset} sx={{ mt: 3, color: tokens.muted, fontSize: 12.5 }}>
          Try another resume
        </Button>
      </Box>

      {/* Matches grouped by category */}
      <Box sx={{ mt: 6 }}>
        {groups.length === 0 && matches.length === 0 && (
          <Typography sx={{ color: tokens.muted, py: 6, textAlign: "center" }}>
            No strong matches yet. Check back as more events are added.
          </Typography>
        )}
        {groups.map((g, i) => (
          <Section
            key={g.type}
            title={CATEGORY_LABEL[g.type] || `${g.type} events`}
            subtitle={`${g.matches.length} match${g.matches.length === 1 ? "" : "es"}`}
            sx={{ mt: i === 0 ? 0 : 5 }}
          >
            {g.matches.map((m) => <MatchRow key={m.event.id} match={m} />)}
          </Section>
        ))}
      </Box>
    </>
  );
}

function Section({ title, subtitle, children, sx }) {
  return (
    <Box sx={sx}>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="h2" sx={{ fontSize: 26, lineHeight: 1 }}>{title}</Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 13.5, lineHeight: 1, mt: 0.75 }}>{subtitle}</Typography>
      </Box>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}

function MatchRow({ match }) {
  const { event, score, reason } = match;
  const { day, mon, isRange } = tileFor(event.date, event.end_date);
  const catColor = tokens.category[event.type] || tokens.muted;
  const strength = score >= 0.7 ? "Strong match" : score >= 0.6 ? "Good match" : "Related";

  return (
    <Box
      component={Link}
      to={`/events/${event.id}`}
      sx={{
        display: "block",
        bgcolor: tokens.paper,
        border: `1px solid ${tokens.line}`,
        borderRadius: 3,
        p: { xs: 2.25, md: 2.75 },
        transition: ".15s",
        boxShadow: "0 1px 2px rgba(60,40,20,.03)",
        "&:hover": { borderColor: "#d8cdb8", transform: "translateY(-2px)", boxShadow: tokens.shadow },
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ sm: "center" }}>
        <Box sx={{ textAlign: "center", minWidth: isRange ? 84 : 68, borderRight: { sm: `1px solid ${tokens.line}` }, pr: { sm: 2.5 } }}>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: isRange ? 20 : 26, lineHeight: 1 }}>{day}</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: tokens.muted, mt: 0.4 }}>{mon}</Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: catColor, flexShrink: 0, display: "block" }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: 1, display: "flex", alignItems: "center" }}>
              {event.type}
            </Typography>
            <Box sx={{ ml: "auto" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.accentDark, lineHeight: 1 }}>{strength}</Typography>
            </Box>
          </Stack>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 19, lineHeight: 1.25, mb: 0.75 }}>
            {event.title}
          </Typography>
          <Typography sx={{ color: tokens.accentDark, fontSize: 13.5, fontWeight: 500, mb: 1.25 }}>
            {reason}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ color: tokens.muted, fontSize: 13.5, fontWeight: 500 }}>
            <span>{event.online ? "Online" : (event.city || "-")}</span>
            <span>via {event.source}</span>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
