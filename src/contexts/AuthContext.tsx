"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  getCurrentUser,
  ensureProfile,
  getProfileMaybe,
  isProfileComplete,
} from "@/src/services/supabase/api";
import { profileSetupUrl } from "@/src/services/supabase/profileRoutes";
import { isSupabaseConfigured } from "@/src/services/supabase/client";
import type { UserProfile } from "@/src/types/models";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  username: string;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  username: "",
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/", "/signin", "/signup", "/play"];

export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    username: "",
    loading: true,
  });

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }

      const user = await getCurrentUser();

      if (!user) {
        setState((s) => ({ ...s, loading: false }));
        if (!PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
          router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      const fallback = user.email?.split("@")[0] ?? "user";
      await ensureProfile(user, fallback);
      const profile = await getProfileMaybe(user.id);

      if (!isProfileComplete(profile) && !pathname.startsWith("/profile")) {
        router.replace(profileSetupUrl(pathname));
        return;
      }

      const username = profile?.name ?? profile?.username ?? fallback;
      setState({ user, profile, username, loading: false });
    }

    void init();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
  );
}
