"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Field";
import {
  addParticipant,
  findSessionByCode,
  getCurrentUser,
} from "@/src/services/supabase/api";
import { isSupabaseConfigured } from "@/src/services/supabase/client";

export function JoinPanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function join() {
    if (!isSupabaseConfigured) {
      setStatus("Configure Supabase ENV first.");
      return;
    }
    if (!code.trim()) {
      setStatus("Session code is required.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const session = await findSessionByCode(code.trim());
      const user = await getCurrentUser();
      const guestNickname = localStorage.getItem("kahootkz_guest_nickname") ?? "";
      const finalNickname = nickname.trim() || guestNickname || "Guest";
      const participant = await addParticipant(session.id, finalNickname, user?.id);
      router.push(`/play?session=${session.id}&participant=${participant.id}`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <h1 className="mb-3 text-2xl font-bold">Join Session</h1>
        <div className="space-y-3">
          <Input
            value={code}
            placeholder="Join code"
            onChange={(event) => setCode(event.target.value)}
          />
          <Input
            value={nickname}
            placeholder="Nickname (optional if guest nickname already saved)"
            onChange={(event) => setNickname(event.target.value)}
          />
          <Button disabled={loading} onClick={join}>
            Join
          </Button>
          {status && <p className="text-sm text-violet-700">{status}</p>}
        </div>
      </Card>
    </div>
  );
}
