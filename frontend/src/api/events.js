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

// Semantic search — ranks events by meaning.
export async function searchEvents(q, type) {
  const params = { q };
  if (type) params.type = type;
  const { data } = await api.get("/events/search", { params });
  return data;
}

// Publish a user-posted event.
export async function createEvent(payload) {
  const { data } = await api.post("/events", payload);
  return data;
}

// Events posted by the signed-in user.
export async function getMyEvents() {
  const { data } = await api.get("/events/mine");
  return data;
}

// Edit an event you posted. Payload is partial — only send what changed.
export async function updateEvent({ id, ...patch }) {
  const { data } = await api.patch(`/events/${id}`, patch);
  return data;
}

// Unpublish an event you posted.
export async function deleteEvent(id) {
  await api.delete(`/events/${id}`);
}

// Resume + intent → matched events (multipart form).
export async function matchResume({ file, intent }) {
  const fd = new FormData();
  if (file) fd.append("resume", file);
  if (intent) fd.append("intent", intent);
  const { data } = await api.post("/match/resume", fd);
  return data;
}
