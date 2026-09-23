import { api } from "./client";

// Signal interest in finding teammates for a specific event.
export async function createTeammatePost({ event_id, pitch, contact }) {
  const { data } = await api.post("/teammates", { event_id, pitch, contact });
  return data;
}

// Global feed of everyone looking for teammates. Filters are optional.
export async function getTeammates({ type, city, online } = {}) {
  const params = {};
  if (type) params.type = type;
  if (city) params.city = city;
  if (online !== undefined) params.online = online;
  const { data } = await api.get("/teammates", { params });
  return data;
}

// Just the teammate posts for one hackathon.
export async function getTeammatesForEvent(eventId) {
  const { data } = await api.get(`/teammates/event/${eventId}`);
  return data;
}

// Every teammate post the signed-in user has made.
export async function getMyTeammatePosts() {
  const { data } = await api.get("/teammates/mine");
  return data;
}

// Withdraw yourself from a teammate board.
export async function deleteTeammatePost(id) {
  await api.delete(`/teammates/${id}`);
}
