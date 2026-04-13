"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedLayout } from "@/src/components/layout/AuthenticatedLayout";
import {
  ensureProfile,
  getCurrentUser,
  getProfileMaybe,
  isProfileComplete,
} from "@/src/services/supabase/api";
import { profileSetupUrl } from "@/src/services/supabase/profileRoutes";
import { isSupabaseConfigured } from "@/src/services/supabase/client";

export function ReportsPanel() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) return;
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/signin?next=/reports");
        return;
      }
      const fallback = user.email?.split("@")[0] ?? "user";
      await ensureProfile(user, fallback);
      const profile = await getProfileMaybe(user.id);
      if (!isProfileComplete(profile)) {
        router.replace(profileSetupUrl("/reports"));
        return;
      }
      setUsername(profile?.name ?? profile?.username ?? fallback);
    }
    void init();
  }, [router]);

  return (
    <AuthenticatedLayout username={username}>
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="mt-2 text-sm text-white">
            Session history and analytics will appear here soon.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
