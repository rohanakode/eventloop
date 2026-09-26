import { useEffect } from "react";
import { Container, Box, Stack, Typography } from "@mui/material";
import { useLocation } from "react-router-dom";
import { tokens } from "../theme";

export default function LegalPage() {
  const { hash } = useLocation();

  // Jump to #terms / #privacy when linked from the footer.
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <Container maxWidth="md" sx={{ pb: 12 }}>
      <Box sx={{ pt: 7 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.accentDark, letterSpacing: "0.4px", textTransform: "uppercase", mb: 2 }}>
          The fine print
        </Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 52 }, lineHeight: 1.05, maxWidth: "18ch" }}>
          Terms &amp; Privacy
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 16, mt: 2, maxWidth: "60ch" }}>
          The short, honest version. EventLoop is a side project - no lawyers involved, just what actually happens with your data and the events you see.
        </Typography>
      </Box>

      {/* Terms */}
      <Box id="terms" sx={{ mt: 7, scrollMarginTop: "90px" }}>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 26, color: tokens.ink, mb: 2.5 }}>
          Terms
        </Typography>
        <Stack spacing={2} sx={{ color: "#4a463d", fontSize: 15.5, lineHeight: 1.7, maxWidth: "64ch" }}>
          <Typography sx={{ fontSize: 15.5 }}>
            EventLoop aggregates event details from third-party sites (Devfolio, Meetup, others) and lets community members post their own. Details can be outdated, incorrect, or changed after posting. <b style={{ color: tokens.ink }}>Confirm dates, location, and registration on the source site before showing up.</b>
          </Typography>
          <Typography sx={{ fontSize: 15.5 }}>
            User-posted events are the responsibility of whoever posted them. EventLoop reviews for obvious spam but doesn't verify events or vet hosts. Posting an event you don't own, or that violates the source's terms, may get the account removed.
          </Typography>
          <Typography sx={{ fontSize: 15.5 }}>
            The site is offered as-is, no warranties, no guarantee of uptime. It's a side project.
          </Typography>
        </Stack>
      </Box>

      {/* Privacy */}
      <Box id="privacy" sx={{ mt: 6, pt: 5, borderTop: `1px solid ${tokens.line}`, scrollMarginTop: "90px" }}>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 26, color: tokens.ink, mb: 2.5 }}>
          Privacy
        </Typography>
        <Stack spacing={2} sx={{ color: "#4a463d", fontSize: 15.5, lineHeight: 1.7, maxWidth: "64ch" }}>
          <Typography sx={{ fontSize: 15.5 }}>
            You can browse events and match your resume without signing in. An account is only needed to post an event, join a teammate board, or delete your data.
          </Typography>
          <Typography sx={{ fontSize: 15.5 }}>
            If you sign up, EventLoop stores your email and the display name you enter. Auth is handled by Supabase. Nothing else.
          </Typography>
          <Typography sx={{ fontSize: 15.5 }}>
            Resumes uploaded for matching are read in memory, distilled to a short profile (headline, skills, interests), and immediately discarded. The PDF itself is never written to disk.
          </Typography>
          <Typography sx={{ fontSize: 15.5 }}>
            No third-party analytics, no ad trackers, no cookies beyond what Supabase sets to keep you signed in.
          </Typography>
          <Typography sx={{ fontSize: 15.5 }}>
            You can delete your account any time from the header dropdown. Deletion wipes your events, teammate posts, and auth record.
          </Typography>
        </Stack>
      </Box>

      <Typography sx={{ fontSize: 13.5, color: tokens.muted, mt: 6 }}>
        Questions or objections?{" "}
        <Box component="a" href="mailto:rohanakode12@gmail.com" sx={{ color: tokens.accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          rohanakode12@gmail.com
        </Box>
      </Typography>
    </Container>
  );
}
