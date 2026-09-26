import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Only wipe the cache on an actual sign-out - not on the initial
      // "no session" event a signed-out user sees on page load, otherwise
      // in-flight queries get their results dropped on the floor.
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      loading,
      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      // `name` is stored in Supabase user_metadata so the profile section can read it back.
      signUp: (email, password, name) => supabase.auth.signUp({
        email,
        password,
        options: name ? { data: { name } } : undefined,
      }),
      resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
      signOut: async () => {
        const res = await supabase.auth.signOut();
        queryClient.clear();
        return res;
      },
    }),
    [session, loading, queryClient]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
