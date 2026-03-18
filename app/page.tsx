import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-cyan-500">
      <header className="flex items-center justify-between bg-orange-500 px-11 py-2">
        <Link href="/" className="text-sm font-semibold text-white">
          Aqyldy quiz
        </Link>
        <Link
          href="/signin"
          className="rounded-md bg-cyan-500 px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-600"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-44px)] max-w-3xl flex-col items-center justify-center px-6">
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
