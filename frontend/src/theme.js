import { createTheme } from "@mui/material/styles";

// Editorial design tokens — shared across components for a consistent look.
export const tokens = {
  accent: "#cf4d24",
  accentDark: "#a83a17",
  accentSoft: "#f6e4d8",
  cream: "#f5f1e8",
  paper: "#fffdf8",
  ink: "#1c1a16",
  muted: "#8b8477",
  line: "#e7ded0",
  shadow: "0 2px 4px rgba(60,40,20,.04), 0 14px 34px rgba(80,55,30,.07)",
  serif: "'Fraunces', Georgia, serif",
  // Category colours (dots / accents)
  category: {
    hackathon: "#7c3aed",
    networking: "#0891b2",
    workshop: "#059669",
    conference: "#d97706",
    startup: "#db2777",
    communication: "#0d9488",
  },
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: tokens.accent, dark: tokens.accentDark, contrastText: "#fff" },
    background: { default: tokens.cream, paper: tokens.paper },
    text: { primary: tokens.ink, secondary: tokens.muted },
    divider: tokens.line,
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: { fontFamily: tokens.serif, fontWeight: 400, letterSpacing: "-1.5px" },
    h2: { fontFamily: tokens.serif, fontWeight: 500, letterSpacing: "-0.5px" },
    h3: { fontFamily: tokens.serif, fontWeight: 500, letterSpacing: "-0.5px" },
    h4: { fontFamily: tokens.serif, fontWeight: 500, letterSpacing: "-0.3px" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 100, paddingInline: 20, paddingBlock: 10 },
      },
    },
  },
});

export default theme;
