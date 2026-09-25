import { Container, Box, Stack, Typography, Button, Chip } from "@mui/material";
import { Link } from "react-router-dom";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import { tokens } from "../theme";

export default function AboutPage() {
  return (
    <Container maxWidth="md" sx={{ pb: 10 }}>
      {/* Eyebrow */}
      <Box sx={{ pt: 7 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.accentDark, letterSpacing: "0.4px", textTransform: "uppercase", mb: 2 }}>
          About
        </Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: 40, md: 56 }, lineHeight: 1.02, maxWidth: "18ch" }}>
          Built by one person, for Hyderabad's tech scene.
        </Typography>
      </Box>

      {/* Founder card */}
      <Box sx={{ mt: 6, mb: 5 }}>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>
          Rohan Akode
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 15, mt: 0.5, mb: 2 }}>
          Full-stack dev · Hyderabad
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Chip
            component="a"
            href="mailto:rohanakode12@gmail.com"
            clickable
            icon={<EmailIcon sx={{ fontSize: 16 }} />}
            label="rohanakode12@gmail.com"
            sx={{ bgcolor: tokens.paper, border: `1px solid ${tokens.line}` }}
          />
          <Chip
            component="a"
            href="https://github.com/rohanakode"
            target="_blank"
            rel="noreferrer"
            clickable
            icon={<GitHubIcon sx={{ fontSize: 16 }} />}
            label="github.com/rohanakode"
            sx={{ bgcolor: tokens.paper, border: `1px solid ${tokens.line}` }}
          />
        </Stack>
      </Box>

      {/* The story */}
      <Stack spacing={3} sx={{ fontSize: 16.5, color: "#4a463d", lineHeight: 1.75, maxWidth: "62ch" }}>
        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 22, color: tokens.ink }}>
          Why this exists
        </Typography>
        <Typography>
          I kept missing hackathons because they were scattered across Devfolio, Meetup, WhatsApp groups, and random Twitter threads. There was no single feed for what's actually happening in Hyderabad this week.
        </Typography>
        <Typography>
          So I built one. EventLoop pulls hackathons and meetups from the sites I already checked, lets community hosts post their own, and tries to match events to whoever you are based on your resume.
        </Typography>

        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 22, color: tokens.ink, mt: 2 }}>
          What's live
        </Typography>
        <Typography component="div">
          <Box component="ul" sx={{ pl: 3, m: 0, "& li": { mb: 0.75 } }}>
            <li>Events from Devfolio and Meetup, refreshed daily</li>
            <li>Anyone signed in can post their own event</li>
            <li>Resume matching. Upload once, get 6–8 events that fit</li>
            <li>Teammate board per hackathon, plus a global feed</li>
          </Box>
        </Typography>

        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 22, color: tokens.ink, mt: 2 }}>
          Known rough edges
        </Typography>
        <Typography component="div">
          <Box component="ul" sx={{ pl: 3, m: 0, "& li": { mb: 0.75 } }}>
            <li>Scrapes break when Devfolio or Meetup redesign. Fixed as I catch them.</li>
            <li>Resume matcher's "seniority" guess is sometimes wrong. It's a rough signal.</li>
            <li>Only Hyderabad and online events for now. Other cities coming as I find sources.</li>
          </Box>
        </Typography>

        <Typography sx={{ mt: 2 }}>
          If something is broken, or an event source you use isn't listed, email me. I read every message.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 5 }}>
        <Button component={Link} to="/" variant="contained" size="large">
          Browse events
        </Button>
        <Button
          component="a"
          href="mailto:rohanakode12@gmail.com"
          variant="outlined"
          size="large"
          sx={{ borderColor: tokens.line, color: tokens.ink }}
        >
          Say hi
        </Button>
      </Stack>

      {/* Legal — Terms + Privacy */}
      <Box sx={{ mt: 10, pt: 5, borderTop: `1px solid ${tokens.line}` }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.muted, letterSpacing: "0.4px", textTransform: "uppercase", mb: 3 }}>
          The fine print
        </Typography>

        <Stack spacing={4} sx={{ color: tokens.muted, fontSize: 14.5, lineHeight: 1.7, maxWidth: "62ch" }}>
          <Box>
            <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 18, color: tokens.ink, mb: 1.25 }}>
              Terms
            </Typography>
            <Typography sx={{ fontSize: 14.5, color: tokens.muted, mb: 1 }}>
              EventLoop aggregates event details from third-party sites (Devfolio, Meetup, others) and lets community members post their own. Details can be outdated, incorrect, or changed after posting. <b style={{ color: tokens.ink }}>Confirm dates, location, and registration on the source site before showing up.</b>
            </Typography>
            <Typography sx={{ fontSize: 14.5, color: tokens.muted, mb: 1 }}>
              User-posted events are the responsibility of whoever posted them. EventLoop reviews for obvious spam but doesn't verify events or vet hosts. Posting an event you don't own, or that violates the source's terms, may get the account removed.
            </Typography>
            <Typography sx={{ fontSize: 14.5, color: tokens.muted }}>
              The site is offered as-is, no warranties, no guarantee of uptime. It's a side project.
            </Typography>
          </Box>

          <Box>
            <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 18, color: tokens.ink, mb: 1.25 }}>
              Privacy
            </Typography>
            <Typography sx={{ fontSize: 14.5, color: tokens.muted, mb: 1 }}>
              If you sign up, EventLoop stores your email and the display name you enter. Auth is handled by Supabase. Nothing else.
            </Typography>
            <Typography sx={{ fontSize: 14.5, color: tokens.muted, mb: 1 }}>
              Resumes uploaded for matching are read in memory, distilled to a short profile (headline, skills, interests), and immediately discarded. The PDF itself is never written to disk.
            </Typography>
            <Typography sx={{ fontSize: 14.5, color: tokens.muted, mb: 1 }}>
              No third-party analytics, no ad trackers, no cookies beyond what Supabase sets to keep you signed in.
            </Typography>
            <Typography sx={{ fontSize: 14.5, color: tokens.muted }}>
              You can delete your account any time from the header dropdown. Deletion wipes your events, teammate posts, and auth record.
            </Typography>
          </Box>

          <Typography sx={{ fontSize: 12.5, color: tokens.muted, pt: 1 }}>
            Questions or objections?{" "}
            <Box component="a" href="mailto:rohanakode12@gmail.com" sx={{ color: tokens.accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
              rohanakode12@gmail.com
            </Box>
          </Typography>
        </Stack>
      </Box>
    </Container>
  );
}
