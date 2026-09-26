import ReactMarkdown from "react-markdown";
import { Box, Typography } from "@mui/material";
import { tokens } from "../theme";

// Renders an event description written in Markdown (our scrapers now preserve
// the source's headings, bold labels and bullet lists as Markdown). react-markdown
// is safe by default -- it does NOT render raw HTML, so scraped content can't
// inject markup. Elements are themed to match the editorial look.
const components = {
  p: ({ children }) => (
    <Typography sx={{ color: "#4a463d", fontSize: 16, lineHeight: 1.75, mb: 1.5 }}>{children}</Typography>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 700, color: tokens.ink }}>{children}</Box>
  ),
  em: ({ children }) => <Box component="em" sx={{ fontStyle: "italic" }}>{children}</Box>,
  a: ({ href, children }) => (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      sx={{ color: tokens.accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
    >
      {children}
    </Box>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 3, m: 0, mb: 1.75, "& li": { mb: 0.6 } }}>{children}</Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ pl: 3, m: 0, mb: 1.75, "& li": { mb: 0.6 } }}>{children}</Box>
  ),
  li: ({ children }) => (
    <Box component="li" sx={{ color: "#4a463d", fontSize: 16, lineHeight: 1.7 }}>{children}</Box>
  ),
  h1: ({ children }) => <Heading>{children}</Heading>,
  h2: ({ children }) => <Heading>{children}</Heading>,
  h3: ({ children }) => <Heading>{children}</Heading>,
  h4: ({ children }) => <Heading>{children}</Heading>,
  h5: ({ children }) => <Heading>{children}</Heading>,
  h6: ({ children }) => <Heading>{children}</Heading>,
};

function Heading({ children }) {
  return (
    <Typography
      sx={{ fontFamily: tokens.serif, fontWeight: 600, fontSize: 17, color: tokens.ink, mt: 2.5, mb: 1 }}
    >
      {children}
    </Typography>
  );
}

export default function Markdown({ children }) {
  if (!children) return null;
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}
