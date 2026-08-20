"use client";

import { createBrowserClient } from "@supabase/ssr/dist/main/createBrowserClient";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const SESSION_CACHE_KEY = "oh-session-cache";

function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

function toAppUser(user: User) {
  const name =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user.email?.split("@")[0] ?? "User";

  return {
    id: user.id,
    email: user.email ?? "",
    name,
    image:
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null,
  };
}

function toSessionData(session: Session | null) {
  if (!session?.user) return null;

  return {
    user: toAppUser(session.user),
    session: {
      id: session.access_token,
      userId: session.user.id,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : null,
    },
  };
}

function toAuthData(data: { session: Session | null; user: User | null }) {
  return {
    user: data.user ? toAppUser(data.user) : null,
    session: data.session
      ? {
          id: data.session.access_token,
          userId: data.session.user.id,
          expiresAt: data.session.expires_at
            ? new Date(data.session.expires_at * 1000)
            : null,
        }
      : null,
  };
}

export const authClient = {
  useSession,
};

export const signIn = {
  email: async ({ email, password }: { email: string; password: string }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        data: null,
        error: new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."),
      };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data: toAuthData(data), error };
  },
  social: async ({ provider }: { provider: "google" | "apple" }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        data: null,
        error: new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."),
      };
    }
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    return { data, error };
  },
};

export const signUp = {
  email: async ({
    name,
    email,
    password,
  }: {
    name: string;
    email: string;
    password: string;
  }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        data: null,
        error: new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."),
      };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, full_name: name },
      },
    });
    return { data: toAuthData(data), error };
  },
};

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    localStorage.removeItem(SESSION_CACHE_KEY);
    return { error: null };
  }
  const result = await supabase.auth.signOut();
  localStorage.removeItem(SESSION_CACHE_KEY);
  return result;
}

/**
 * Optimistic Supabase session hook: returns cached session from localStorage
 * immediately while Supabase validates browser cookies in the background.
 */
export function useSession() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [data, setData] = useState<ReturnType<typeof toSessionData>>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    if (!supabase) {
      setIsPending(false);
      return;
    }

    try {
      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      if (cached) {
        setData(JSON.parse(cached) as ReturnType<typeof toSessionData>);
      }
    } catch {
      localStorage.removeItem(SESSION_CACHE_KEY);
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: sessionData, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError);
        const nextData = toSessionData(sessionData.session);
        setData(nextData);
        setIsPending(false);

        if (nextData) {
          localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(nextData));
        } else {
          localStorage.removeItem(SESSION_CACHE_KEY);
        }
      })
      .catch((sessionError: Error) => {
        if (!active) return;
        setError(sessionError);
        setIsPending(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextData = toSessionData(session);
      setData(nextData);
      setIsPending(false);
      if (nextData) {
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(nextData));
      } else {
        localStorage.removeItem(SESSION_CACHE_KEY);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    data: isMounted ? data : null,
    error,
    isPending,
  };
}
