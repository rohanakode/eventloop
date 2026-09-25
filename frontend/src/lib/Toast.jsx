import { createContext, useCallback, useContext, useState } from "react";
import { Snackbar, Box, Typography, Slide } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import { tokens } from "../theme";

const ToastCtx = createContext(null);

// Editorial toast — cream card, accent icon, ink text. Slides up from the
// bottom-center. Call `showToast("...")` for a plain success toast, or
// `showToast("...", "error"|"info"|"sparkle")` for a themed variant.
export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  const showToast = useCallback((message, variant = "success") => {
    if (!message) return;
    setToast({ open: true, message, variant });
  }, []);

  const close = () => setToast((t) => ({ ...t, open: false }));

  const meta = VARIANTS[toast.variant] || VARIANTS.success;

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <Snackbar
        open={toast.open}
        onClose={close}
        autoHideDuration={2800}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        TransitionComponent={SlideUp}
        sx={{ mb: { xs: 1, sm: 2 } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            bgcolor: tokens.paper,
            border: `1px solid ${tokens.line}`,
            borderRadius: 100,
            pl: 1,
            pr: 2.5,
            py: 1,
            minWidth: 240,
            maxWidth: 480,
            boxShadow: "0 8px 28px rgba(60,40,20,.12), 0 2px 6px rgba(60,40,20,.06)",
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              bgcolor: meta.bg,
              color: meta.color,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <meta.Icon sx={{ fontSize: 18 }} />
          </Box>
          <Typography sx={{ fontSize: 14.5, fontWeight: 500, color: tokens.ink, lineHeight: 1.3 }}>
            {toast.message}
          </Typography>
        </Box>
      </Snackbar>
    </ToastCtx.Provider>
  );
}

const VARIANTS = {
  success: { Icon: CheckCircleIcon, bg: "#e7f5ec", color: "#1f7a3d" },
  error:   { Icon: ErrorOutlineIcon, bg: "#fce9e9", color: "#c94f4f" },
  info:    { Icon: InfoIcon,         bg: tokens.accentSoft, color: tokens.accentDark },
  sparkle: { Icon: CheckCircleIcon,  bg: tokens.accentSoft, color: tokens.accent },
};

function SlideUp(props) {
  return <Slide {...props} direction="up" />;
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
