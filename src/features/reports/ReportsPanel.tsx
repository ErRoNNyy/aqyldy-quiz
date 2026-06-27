"use client";

import { AuthenticatedLayout } from "@/src/components/layout/AuthenticatedLayout";
import { useAuth } from "@/src/contexts/AuthContext";

export function ReportsPanel() {
  const { username } = useAuth();

  return (
    <AuthenticatedLayout username={username}>
      <div className="flex flex-1 items-center justify-center bg-[#E0EFF0]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black">Reports</h1>
          <p className="mt-2 text-sm text-black font-semibold">
            Session history and analytics will appear here soon.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
