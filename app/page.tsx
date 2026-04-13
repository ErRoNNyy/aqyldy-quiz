"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SiteHeader,
  SiteHeaderActionLink,
} from "@/src/components/layout/SiteHeader";
import { getCurrentUser } from "@/src/services/supabase/api";
import { isSupabaseConfigured } from "@/src/services/supabase/client";

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function check() {
      if (isSupabaseConfigured) {
        const user = await getCurrentUser();
        if (user) {
          router.replace("/home");
          return;
        }
      }
      setChecked(true);
    }
    void check();
  }, [router]);

  if (!checked) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader right={<SiteHeaderActionLink href="/signin">Sign in</SiteHeaderActionLink>} />

      <main className="mx-auto flex min-h-[calc(100vh-3.25rem)] max-w-3xl flex-col items-center justify-center px-6">
        <h1 className="mb-16 text-center text-4xl font-bold text-white">Welcome to Aqyldy quiz!</h1>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link
            href="/join"
            className="rounded-md bg-orange-500 px-8 py-5 text-center text-3xl font-semibold text-white transition hover:bg-orange-600"
          >
            JOIN QUIZ
          </Link>
          <Link
            href="/signup"
            className="self-center rounded-md bg-orange-500 px-10 py-2.5 text-2xl font-semibold text-white transition hover:bg-orange-600"
          >
            Sign up for FREE
          </Link>
        </div>
      </main>
    </div>
  );
}
