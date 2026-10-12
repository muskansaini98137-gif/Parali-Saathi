import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { AuthContext } from "./authContext.js";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [profileError, setProfileError] = useState("");
  const profileRequestRef = useRef(0);

  async function loadProfile(userId) {
    if (!supabase) return null;

    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;
    setLoading(true);
    setProfile(null);
    setProfileError("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileRequestRef.current !== requestId) return null;
      if (error || !data) {
        setProfileError(
          "auth.errors.profileMissing"
        );
        return null;
      }

      setProfile(data);
      return data;
    } catch {
      if (profileRequestRef.current === requestId) {
        setProfileError(
          "auth.errors.profileLoad"
        );
      }
      return null;
    } finally {
      if (profileRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      if (!nextSession) {
        profileRequestRef.current += 1;
        setProfile(null);
        setProfileError("");
        setLoading(false);
        return;
      }

      setProfile(null);
      setLoading(true);
      window.setTimeout(() => {
        if (active) void loadProfile(nextSession.user.id);
      }, 0);
    });

    async function restoreSession() {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (!active) return;

        if (error) {
          setProfileError("auth.errors.sessionLoad");
          setLoading(false);
          return;
        }

        setSession(sessionData.session);
        if (sessionData.session) {
          await loadProfile(sessionData.session.user.id);
        } else {
          setLoading(false);
        }
      } catch {
        if (active) {
          setProfileError("auth.errors.sessionNetwork");
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
      profileRequestRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signUp({ email, password, role, profile: profileData }) {
    if (!supabase) throw new Error("supabase_not_configured");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, ...profileData },
      },
    });

    if (error) throw error;
    if (data.session && data.user) {
      setSession(data.session);
      await loadProfile(data.user.id);
    }
    return data;
  }

  async function signIn({ email, password }) {
    if (!supabase) throw new Error("supabase_not_configured");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (data.session && data.user) {
      setSession(data.session);
      await loadProfile(data.user.id);
    }
    return data;
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function refreshProfile() {
    if (!session?.user?.id) return null;
    return loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        profileError,
        isConfigured: isSupabaseConfigured,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}