"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { id: "home", href: "/home", label: "Home" },
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "discover", href: "/discover", label: "Discover" },
  { id: "reports", href: "/reports", label: "Reports" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-white/25 bg-background px-3 py-5">
      {navItems.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={clsx(
            "rounded-md px-4 py-2.5 text-sm font-semibold transition",
            pathname === item.href
              ? "bg-cyan-600 text-white"
              : "text-white hover:bg-cyan-600",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
