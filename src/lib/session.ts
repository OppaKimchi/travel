import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { clearCache, readCache, writeCache } from "./cache";
import { isNetworkError } from "./errors";
import { supabase } from "./supabase";

export type CurrentUser = { id: string; email: string };

type SessionState = {
  ready: boolean;
  user: CurrentUser | null;
  // True when there's no connection to confirm the sign-in, so the app is
  // running from the copy saved on this phone.
  offline: boolean;
};

function toUser(session: Session | null): CurrentUser | null {
  return session ? { id: session.user.id, email: session.user.email ?? "" } : null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ ready: false, user: null, offline: false });

  useEffect(() => {
    let active = true;

    const signedIn = (user: CurrentUser) => {
      writeCache("me", user);
      setState({ ready: true, user, offline: false });
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      const user = toUser(data.session);
      if (user) return signedIn(user);
      const cached = readCache<CurrentUser>("me");
      if (cached && (!navigator.onLine || (error && isNetworkError(error)))) {
        setState({ ready: true, user: cached.data, offline: true });
      } else {
        setState({ ready: true, user: null, offline: false });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        clearCache();
        setState({ ready: true, user: null, offline: false });
        return;
      }
      const user = toUser(session);
      if (user) signedIn(user);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut(): Promise<void> {
  clearCache();
  // "local" signs out this phone without needing a connection.
  await supabase.auth.signOut({ scope: "local" });
}
