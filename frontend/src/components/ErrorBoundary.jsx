import { Component } from "react";
import { Box, Typography, Button } from "@mui/material";
import { tokens } from "../theme";

// Simple error boundary so a render-time exception surfaces its message
// instead of collapsing the whole app to a blank page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    /* eslint-disable no-console */
    console.group("%c[EventLoop] Render error caught by ErrorBoundary", "color:#cf4d24;font-weight:bold;");
    console.error("Message:", error?.message);
    console.error("Stack:", error?.stack);
    if (info?.componentStack) console.error("Component stack:", info.componentStack);
    console.groupEnd();
    /* eslint-enable no-console */
  }

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error?.message || String(this.state.error);
    return (
      <Box sx={{ maxWidth: 640, mx: "auto", mt: 10, p: 4, textAlign: "center" }}>
        <Typography variant="h1" sx={{ fontSize: 34, mb: 2 }}>
          Something{" "}
          <Box component="em" sx={{ fontStyle: "italic", fontWeight: 500, color: tokens.accent }}>
            went sideways.
          </Box>
        </Typography>
        <Typography sx={{ color: tokens.muted, mb: 3, whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 13 }}>
          {msg}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </Box>
    );
  }
}
