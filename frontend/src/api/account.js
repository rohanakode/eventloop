import { api } from "./client";

// Permanently delete the current user's account + all their events.
export async function deleteAccount() {
  await api.delete("/account/me");
}
