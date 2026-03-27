"use client";

import type { PropsWithChildren } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AuthenticatedLayoutProps {
  username?: string;
}

export function AuthenticatedLayout({
  children,
  username,
}: PropsWithChildren<AuthenticatedLayoutProps>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header username={username} />
      <div className="flex flex-1">
        <Sidebar />
        {children}
      </div>
    </div>
  );
}
