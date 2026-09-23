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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // On sign-out (or user swap on the same tab), wipe cached fetches so
      // one user never sees another user's data flash on screen.
      if (!s) queryClient.clear();
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
        redirectTo: `${window.location.origin}/`,
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
