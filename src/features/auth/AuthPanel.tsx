"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Field";
import {
  ensureProfile,
  getCurrentUser,
  signIn,
  signUp,
} from "@/src/services/supabase/api";
import { isSupabaseConfigured } from "@/src/services/supabase/client";

type Mode = "signin" | "signup";

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryMode = searchParams.get("mode");
  const nextPath = searchParams.get("next");

  const [mode, setMode] = useState<Mode>(queryMode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");

  const title = useMemo(
    () => (mode === "signin" ? "Sign in to host/create quizzes" : "Create account"),
    [mode],
  );

  async function handleSubmit() {
    if (!isSupabaseConfigured) {
      setMessage(
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) first.",
      );
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await signUp(email, password);
        if (error) {
          throw error;
        }
        const user = await getCurrentUser();
        if (user && username.trim()) {
          await ensureProfile(user, username.trim());
        }
        setMessage("Sign-up complete. Verify your email if confirmation is enabled.");
        setMode("signin");
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          throw error;
        }
        const user = await getCurrentUser();
        if (user && username.trim()) {
          await ensureProfile(user, username.trim());
        }
        router.push(nextPath || "/dashboard");
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function saveGuestNickname() {
    if (!guestName.trim()) {
      setMessage("Please enter a nickname for guest mode.");
      return;
    }
    localStorage.setItem("kahootkz_guest_nickname", guestName.trim());
    setMessage("Guest nickname saved. You can now join sessions.");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">Kahoot KZ - Auth</h1>
        <p className="mb-4 text-sm text-zinc-600">
          Supabase email/password auth for hosts and creators.
        </p>
        <div className="mb-4 flex gap-2">
          <Button
            variant={mode === "signin" ? "primary" : "secondary"}
            onClick={() => setMode("signin")}
          >
            Sign In
          </Button>
          <Button
            variant={mode === "signup" ? "primary" : "secondary"}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </Button>
        </div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <h2 className="text-base font-semibold">{title}</h2>
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            placeholder="Username (stored in users table)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </motion.div>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Guest mode (nickname)</h2>
        <p className="mb-3 text-sm text-zinc-600">
          Guests can join a live session without account sign-in.
        </p>
        <div className="flex gap-3">
          <Input
            value={guestName}
            placeholder="Guest nickname"
            onChange={(e) => setGuestName(e.target.value)}
          />
          <Button onClick={saveGuestNickname}>Save guest</Button>
        </div>
      </Card>

      {message && <p className="text-sm text-violet-700">{message}</p>}
    </div>
  );
}
