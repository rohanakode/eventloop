import axios from "axios";

// Backend base URL. Uses VITE_API_URL in production, localhost in dev.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL });
