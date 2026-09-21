import { api } from "./client";

// Fetch events with optional filters (type, online, city).
export async function getEvents({ type, online, city } = {}) {
  const params = {};
  if (type) params.type = type;
  if (online !== undefined) params.online = online;
  if (city) params.city = city;
  const { data } = await api.get("/events", { params });
  return data;
}

// Fetch a single event by id.
export async function getEvent(id) {
  const { data } = await api.get(`/events/${id}`);
  return data;
}
