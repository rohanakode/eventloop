import { Box } from "@mui/material";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import DiscoverPage from "./pages/DiscoverPage";
import EventDetailPage from "./pages/EventDetailPage";
import ForYouPage from "./pages/ForYouPage";
import PostEventPage from "./pages/PostEventPage";
import TeammatesPage from "./pages/TeammatesPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AboutPage from "./pages/AboutPage";
import LegalPage from "./pages/LegalPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  const { pathname } = useLocation();
  // The Discover feed can grow without bound, so a bottom-of-page footer is
  // never reached there - hide it on that route only. Legal stays reachable
  // via the header (About link, account menu, mobile drawer).
  const showFooter = pathname !== "/";

  return (
    <ErrorBoundary>
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <Box component="main" sx={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<DiscoverPage />} />
            <Route path="/for-you" element={<ForYouPage />} />
            <Route path="/post" element={<PostEventPage />} />
            <Route path="/teammates" element={<TeammatesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Box>
        {showFooter && <Footer />}
      </Box>
    </ErrorBoundary>
  );
}
