import { Suspense } from "react";
import { PlayPanel } from "@/src/features/session/PlayPanel";

export default function PlayPage() {
  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <Suspense fallback={<p className="mx-auto max-w-3xl text-sm">Loading session...</p>}>
        <PlayPanel />
      </Suspense>
    </main>
  );
}
