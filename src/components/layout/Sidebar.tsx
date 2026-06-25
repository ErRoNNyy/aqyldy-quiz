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
    <nav className="flex w-48 shrink-0 flex-col border-r border-white/15 bg-[#008F9F]">
      {navItems.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={clsx(
            "px-5 py-4 text-sm font-semibold transition",
            pathname === item.href
              ? "bg-[#16AAB9] text-white"
              : "text-white hover:bg-[#16AAB9]",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
