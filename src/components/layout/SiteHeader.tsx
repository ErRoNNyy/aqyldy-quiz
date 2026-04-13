"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Bar height is `min-h-[52px]` (3.25rem); use for `min-h-[calc(100vh-3.25rem)]` under the header. */
export const siteHeaderBarClassName =
  "relative z-50 flex min-h-[52px] shrink-0 items-center justify-between bg-orange-500 px-6 py-2.5";

export const siteHeaderTitleClassName =
  "text-2xl font-semibold text-white transition hover:opacity-90";

export const siteHeaderActionClassName =
  "inline-flex items-center justify-center rounded-md bg-cyan-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-700";

type SiteHeaderProps = {
  right?: ReactNode;
  /** Brand acts as a button (e.g. host leave) instead of a link to `/`. */
  onBrandClick?: () => void;
};

export function SiteHeader({ right, onBrandClick }: SiteHeaderProps) {
  const brand = onBrandClick ? (
    <button type="button" onClick={onBrandClick} className={siteHeaderTitleClassName}>
      Aqyldy quiz
    </button>
  ) : (
    <Link href="/" className={siteHeaderTitleClassName}>
      Aqyldy quiz
    </Link>
  );

  return (
    <header className={siteHeaderBarClassName}>
      {brand}
      {right != null ? right : null}
    </header>
  );
}

export function SiteHeaderActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={siteHeaderActionClassName}>
      {children}
    </Link>
  );
}

export function SiteHeaderActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={siteHeaderActionClassName}>
      {children}
    </button>
  );
}
