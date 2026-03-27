"use client";

import Link from "next/link";

interface HeaderProps {
  username?: string;
}

export function Header({ username }: HeaderProps) {
  return (
    <header className="flex items-center justify-between bg-orange-500 px-6 py-2.5">
      <Link href="/" className="text-2xl font-semibold text-white">
        Aqyldy quiz
      </Link>
      {username && (
        <span className="rounded-md bg-cyan-600 px-5 py-1.5 text-sm font-semibold text-white">
          {username}
        </span>
      )}
    </header>
  );
}
