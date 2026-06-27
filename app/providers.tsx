"use client";

import type { PropsWithChildren } from "react";
import { AuthProvider } from "@/src/contexts/AuthContext";

export function Providers({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}
