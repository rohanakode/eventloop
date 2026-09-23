import axios from "axios";
import { supabase } from "../lib/supabase";

// Backend base URL. Uses VITE_API_URL in production, localhost in dev.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL });

// Attach the Supabase JWT to every outgoing request so protected routes
// (POST /events, GET /events/mine, DELETE /events/:id) know who's calling.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: an expired/invalid session on a protected call comes
// back as 401. Sign the user out cleanly so the UI shows the gate again
// instead of a cryptic error toast.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Best-effort sign-out. If already signed out, this is a no-op.
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    return Promise.reject(error);
  }
);
