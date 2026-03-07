import clsx from "clsx";
import type { PropsWithChildren } from "react";

interface CardProps {
  className?: string;
}

export function Card({ children, className }: PropsWithChildren<CardProps>) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}
