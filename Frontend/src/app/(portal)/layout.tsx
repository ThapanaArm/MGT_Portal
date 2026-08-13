"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { EnvProvider } from "@/lib/env-context";
import { AudienceProvider } from "@/lib/audience-context";
import Sidebar from "@/components/Sidebar";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <EnvProvider>
      <AudienceProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <div className="max-w-[980px] mx-auto px-6.5 py-5.5 pb-14">{children}</div>
          </main>
        </div>
      </AudienceProvider>
    </EnvProvider>
  );
}
