import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import ErrorBoundary from "./components/ErrorBoundary";
import DiscoverPage from "./pages/DiscoverPage";
import EventDetailPage from "./pages/EventDetailPage";
import ForYouPage from "./pages/ForYouPage";
import PostEventPage from "./pages/PostEventPage";
import TeammatesPage from "./pages/TeammatesPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Header />
      <Routes>
        <Route path="/" element={<DiscoverPage />} />
        <Route path="/for-you" element={<ForYouPage />} />
        <Route path="/post" element={<PostEventPage />} />
        <Route path="/teammates" element={<TeammatesPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
