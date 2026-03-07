import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kahoot KZ",
  description: "Kahoot-like quiz app built with Next.js + Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="border-b border-zinc-200 bg-white px-4 py-3">
          <nav className="mx-auto flex w-full max-w-6xl flex-wrap gap-4 text-sm">
            <Link className="font-semibold hover:text-violet-700" href="/">
              Home
            </Link>
            <Link className="hover:text-violet-700" href="/auth">
              Auth
            </Link>
            <Link className="hover:text-violet-700" href="/dashboard">
              Dashboard
            </Link>
            <Link className="hover:text-violet-700" href="/host">
              Host
            </Link>
            <Link className="hover:text-violet-700" href="/join">
              Join
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
