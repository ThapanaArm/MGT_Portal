import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { EnvProvider } from "@/features/catalog/env-context";
import { AudienceProvider } from "@/features/catalog/audience-context";
import Sidebar from "@/app/layout/Sidebar";
import TopBar from "@/app/layout/TopBar";

/** โครงหน้าหลังล็อกอิน: Sidebar + TopBar และหน้าลูกแสดงที่ <Outlet /> */
export default function PortalLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <EnvProvider>
      <AudienceProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar />
          <main className="flex-1 min-w-0 flex flex-col">
            <TopBar />
            <div className="max-w-[1320px] w-full mx-auto px-6.5 py-5.5 pb-14"><Outlet /></div>
          </main>
        </div>
      </AudienceProvider>
    </EnvProvider>
  );
}
