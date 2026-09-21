import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import DiscoverPage from "./pages/DiscoverPage";
import EventDetailPage from "./pages/EventDetailPage";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<DiscoverPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
      </Routes>
    </>
  );
}
