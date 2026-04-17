"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/src/services/supabase/api";
import {
  siteHeaderActionClassName,
  siteHeaderBarClassName,
  siteHeaderTitleClassName,
} from "@/src/components/layout/SiteHeader";

interface HeaderProps {
  username?: string;
}

export function Header({ username }: HeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <header className={siteHeaderBarClassName}>
      <div className="justify-self-start">
        <Link href="/" className={siteHeaderTitleClassName}>
          Aqyldy quiz
        </Link>
      </div>
      <div />
      {username ? (
        <div className="relative justify-self-end" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={siteHeaderActionClassName}
          >
            {username}
          </button>

          {open && (
            <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push("/profile");
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
              >
                Profile
              </button>
              <button
                onClick={handleSignOut}
                className="w-full border-t border-zinc-100 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <div />
      )}
    </header>
  );
}
