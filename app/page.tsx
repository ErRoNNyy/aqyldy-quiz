import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-100 p-6">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8">
        <h1 className="text-3xl font-bold">Kahoot KZ (Next.js + Supabase)</h1>
        <p className="text-sm text-zinc-700">
          Kahoot-like app implementation with quiz creation, drag-drop image upload,
          live sessions, and realtime leaderboard.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="rounded-lg border p-3 hover:bg-zinc-50" href="/auth">
            <p className="font-semibold">Authentication</p>
            <p className="text-sm text-zinc-600">Sign in/sign up or save guest nickname</p>
          </Link>
          <Link className="rounded-lg border p-3 hover:bg-zinc-50" href="/dashboard">
            <p className="font-semibold">Quiz Dashboard</p>
            <p className="text-sm text-zinc-600">
              Create quizzes/questions and upload question images
            </p>
          </Link>
          <Link className="rounded-lg border p-3 hover:bg-zinc-50" href="/host">
            <p className="font-semibold">Host</p>
            <p className="text-sm text-zinc-600">Start session, update current question, end</p>
          </Link>
          <Link className="rounded-lg border p-3 hover:bg-zinc-50" href="/join">
            <p className="font-semibold">Join / Play</p>
            <p className="text-sm text-zinc-600">Join by code and answer in realtime</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
