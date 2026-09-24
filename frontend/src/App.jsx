import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import ErrorBoundary from "./components/ErrorBoundary";
import DiscoverPage from "./pages/DiscoverPage";
import EventDetailPage from "./pages/EventDetailPage";
import ForYouPage from "./pages/ForYouPage";
import PostEventPage from "./pages/PostEventPage";
import TeammatesPage from "./pages/TeammatesPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AboutPage from "./pages/AboutPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Header />
      <Routes>
        <Route path="/" element={<DiscoverPage />} />
        <Route path="/for-you" element={<ForYouPage />} />
        <Route path="/post" element={<PostEventPage />} />
        <Route path="/teammates" element={<TeammatesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
