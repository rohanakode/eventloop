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
          What EventLoop is
        </Typography>
        <Typography>
          EventLoop is a single, up-to-date feed for hackathons and tech meetups in Hyderabad. Instead of checking Devfolio, Meetup, WhatsApp groups, and Twitter one by one, you get everything happening this week in one place - with the details you actually need to decide whether to show up.
        </Typography>

        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 22, color: tokens.ink, mt: 2 }}>
          What it does
        </Typography>
        <Typography component="div">
          <Box component="ul" sx={{ pl: 3, m: 0, "& li": { mb: 0.9 } }}>
            <li>Pulls hackathons and meetups from Devfolio, Meetup, and a couple of smaller sources into one feed you can actually filter.</li>
            <li>Reads your resume and floats the events that fit to the top. Upload once, that's it.</li>
            <li>Hosting something yourself? Post it in a minute and it lands in the same feed as everything else.</li>
            <li>A teammate board on every hackathon, plus a global "looking for a team" wall.</li>
          </Box>
        </Typography>

        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 22, color: tokens.ink, mt: 2 }}>
          How it works
        </Typography>
        <Typography component="div">
          <Box component="ol" sx={{ pl: 3, m: 0, "& li": { mb: 0.75 } }}>
            <li>Scrapers pull fresh listings from Devfolio, Meetup, and other sources on a daily schedule, then normalize them into one format.</li>
            <li>Community hosts add events directly - anyone signed in can post, and listings show up in the same feed.</li>
            <li>When you upload a resume, it's read in memory and distilled into a short profile (headline, skills, interests) that's compared against upcoming events to surface your best 6–8 matches. The PDF is discarded immediately, never stored.</li>
            <li>Sign-in and accounts are handled by Supabase; teammate posts and your own events are tied to that account.</li>
          </Box>
        </Typography>

        <Typography sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 22, color: tokens.ink, mt: 2 }}>
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

      {/* Legal - moved to its own page, linked here */}
      <Box sx={{ mt: 8, pt: 4, borderTop: `1px solid ${tokens.line}` }}>
        <Typography sx={{ fontSize: 14.5, color: tokens.muted }}>
          The boring-but-important stuff - how EventLoop handles your data and what to know before showing up to an event - lives on the{" "}
          <Box component={Link} to="/legal" sx={{ color: tokens.accent, textDecoration: "none", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
            Terms &amp; Privacy
          </Box>{" "}
          page.
        </Typography>
      </Box>
    </Container>
  );
}
