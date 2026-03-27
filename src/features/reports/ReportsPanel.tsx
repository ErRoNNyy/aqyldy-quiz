"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedLayout } from "@/src/components/layout/AuthenticatedLayout";
import { getCurrentUser, ensureProfile } from "@/src/services/supabase/api";
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
      const name = user.email?.split("@")[0] ?? "user";
      await ensureProfile(user, name);
      setUsername(name);
    }
    void init();
  }, [router]);

  return (
    <AuthenticatedLayout username={username}>
      <div className="flex flex-1 items-center justify-center bg-cyan-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-700">Reports</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Session history and analytics will appear here soon.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
