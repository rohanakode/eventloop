import { useState, useRef } from "react";
import {
  Container, Box, Stack, Typography, Button, Chip, LinearProgress, Alert,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EastIcon from "@mui/icons-material/East";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { matchResume } from "../api/events";
import { tokens } from "../theme";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const parseDate = (iso) => { const [,m,d]=iso.split("-").map(Number); return {day:String(d).padStart(2,"0"), mon:MONTHS[m-1]}; };

export default function ForYouPage() {
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);

  const mutation = useMutation({ mutationFn: matchResume });
  const result = mutation.data;

  const onFile = (f) => { if (f && f.type === "application/pdf") { setFile(f); mutation.reset(); } };
  const reset = () => { setFile(null); mutation.reset(); };

  return (
    <Container maxWidth="md" sx={{ pb: 10 }}>
      {/* Hero */}
      <Box sx={{ pt: 7, pb: 4, textAlign: "center" }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 58 }, lineHeight: 1.02, maxWidth: "18ch", mx: "auto" }}>
          Events, matched to{" "}
          <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>
            you.
          </Box>
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 18, mt: 2.5, maxWidth: "50ch", mx: "auto", lineHeight: 1.6 }}>
          Drop your resume. We'll read it and rank the events that actually fit.
        </Typography>
      </Box>

      {/* Dropzone */}
      <DropZone
        file={file}
        onClear={reset}
        onFile={onFile}
        onOpen={() => inputRef.current?.click()}
      />
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {file && !result && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={mutation.isPending}
            endIcon={<EastIcon />}
            onClick={() => mutation.mutate({ file })}
            sx={{ px: 4, py: 1.5, fontSize: 15 }}
          >
            {mutation.isPending ? "Reading your resume…" : "Match my events"}
          </Button>
          <Typography sx={{ fontSize: 12.5, color: tokens.muted, mt: 2, display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e" }} />
            Processed in memory. Never stored.
          </Typography>
        </Stack>
      )}

      {mutation.isPending && (
        <LinearProgress sx={{ mt: 3, borderRadius: 100, "& .MuiLinearProgress-bar": { bgcolor: tokens.accent } }} />
      )}
      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {mutation.error?.response?.data?.detail || "Something went wrong. Try again."}
        </Alert>
      )}

      {result && <Results result={result} onReset={reset} />}
    </Container>
  );
}

/* ---------- Sub-components ---------- */

function DropZone({ file, onFile, onClear, onOpen }) {
  const [hover, setHover] = useState(false);
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); onFile(e.dataTransfer.files?.[0]); }}
      onClick={file ? undefined : onOpen}
      sx={{
        minHeight: 220,
        border: `2px dashed ${hover ? tokens.accent : "#d8cdb8"}`,
        borderRadius: 4,
        bgcolor: hover ? "#faf1e8" : tokens.paper,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: file ? "default" : "pointer",
        transition: ".18s",
        px: 3,
        boxShadow: tokens.shadow,
        "&:hover": file ? {} : { borderColor: tokens.accent, bgcolor: "#faf1e8" },
      }}
    >
      {file ? (
        <Stack alignItems="center" spacing={1.5}>
          <Box sx={{ width: 54, height: 54, borderRadius: 2, bgcolor: tokens.accentSoft, color: tokens.accentDark, display: "grid", placeItems: "center" }}>
            <CheckIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 18 }}>{file.name}</Typography>
          <Typography sx={{ fontSize: 13, color: tokens.muted }}>{(file.size / 1024).toFixed(0)} KB</Typography>
          <Button size="small" onClick={onClear} startIcon={<CloseIcon sx={{ fontSize: 14 }} />} sx={{ color: tokens.muted, fontSize: 12.5 }}>
            Choose a different file
          </Button>
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
      <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h2" sx={{ fontSize: 26 }}>{title}</Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 14 }}>{subtitle}</Typography>
      </Stack>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}

function MatchRow({ match }) {
  const { event, score, reason } = match;
  const { day, mon } = parseDate(event.date);
  const catColor = tokens.category[event.type] || tokens.muted;
  const strength = score >= 0.7 ? "Strong match" : score >= 0.6 ? "Good match" : "Related";
  const bar = Math.min(1, Math.max(0.3, score));

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
        <Box sx={{ textAlign: "center", minWidth: 68, borderRight: { sm: `1px solid ${tokens.line}` }, pr: { sm: 2.5 } }}>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 26, lineHeight: 1 }}>{day}</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: tokens.muted, mt: 0.4 }}>{mon}</Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: catColor }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: tokens.muted, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              {event.type}
            </Typography>
            <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.75 }}>
              <AutoAwesomeIcon sx={{ fontSize: 14, color: tokens.accent }} />
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.accentDark }}>{strength}</Typography>
            </Box>
          </Stack>
          <Typography sx={{ fontFamily: tokens.serif, fontWeight: 500, fontSize: 19, lineHeight: 1.25, mb: 0.75 }}>
            {event.title}
          </Typography>
          <Typography sx={{ color: tokens.accentDark, fontSize: 13.5, fontWeight: 500, mb: 1.25 }}>
            ✦ {reason}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ color: tokens.muted, fontSize: 13.5, fontWeight: 500 }}>
            <span>{event.online ? "🌐 Online" : `📍 ${event.city || "—"}`}</span>
            <span>via {event.source}</span>
          </Stack>

          <Box sx={{ mt: 1.5, height: 3, borderRadius: 100, bgcolor: tokens.line, overflow: "hidden" }}>
            <Box sx={{ width: `${bar * 100}%`, height: "100%", bgcolor: tokens.accent, borderRadius: 100 }} />
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}
