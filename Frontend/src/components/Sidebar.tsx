"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale-context";
import { api } from "@/lib/api";
import type { CategoryDto } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  sales: "📈",
  purchase: "🛍️",
  inventory: "📦",
  finance: "💰",
  hr: "👥",
};

function NavItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[15.5px] w-full ${
        active ? "bg-teal-soft text-teal-strong font-semibold" : "text-ink hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useLocale();
  const pathname = usePathname();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [appCount, setAppCount] = useState(0);

  useEffect(() => {
    api.get<CategoryDto[]>("/api/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<{ id: number }[]>("/api/applications").then((apps) => setAppCount(apps.length)).catch(() => {});
    if (user?.roleKey === "admin") {
      api
        .get<{ status: string }[]>("/api/applications?status=pending")
        .then((apps) => setPendingCount(apps.length))
        .catch(() => {});
    }
  }, [user, pathname]);

  return (
    <aside className="bg-surface border-r border-line px-3.5 py-4.5 flex flex-col gap-5 sticky top-0 h-screen overflow-y-auto w-[272px] flex-shrink-0">
      <div className="px-1.5">
        <div className="bg-surface rounded-lg px-3 py-3 flex flex-col items-center justify-center gap-1.5 border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mgt-logo.png" alt="MGT — Do It Right" className="w-full h-auto max-h-[30px] object-contain" />
          <div className="text-[19px] text-teal-strong font-bold tracking-[0.08em] uppercase">{t("nav.brandCaption")}</div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <NavItem href="/ecosystem" active={pathname === "/ecosystem" || pathname.startsWith("/ecosystem/")}>
          ✨ {t("nav.ecosystem")}
        </NavItem>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">{t("nav.developerSection")}</div>
        <NavItem href="/getting-started" active={pathname === "/getting-started"}>
          {"</>"} {t("nav.gettingStarted")}
        </NavItem>
      </div>

      <div className="flex flex-col gap-0.5">
        <NavItem href="/explore" active={pathname === "/explore"}>
          🔍 {t("nav.exploreData")}
        </NavItem>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">{t("nav.apiCategories")}</div>
        {categories.map((c) => (
          <NavItem key={c.key} href={`/api/${c.key}`} active={pathname === `/api/${c.key}`}>
            <span>{CATEGORY_ICONS[c.key] ?? "📁"}</span>
            <span className="flex-1">{c.name}</span>
            <span className="text-[13px] font-mono text-ink-faint bg-surface-2 rounded-full px-1.5">
              {c.endpointCount}
            </span>
          </NavItem>
        ))}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">{t("nav.myApp")}</div>
        <NavItem href="/my-apps" active={pathname === "/my-apps" || pathname.startsWith("/my-apps/")}>
          <span>🗂️</span>
          <span className="flex-1">{t("nav.myApp")}</span>
          <span className="text-[13px] font-mono text-ink-faint bg-surface-2 rounded-full px-1.5">{appCount}</span>
        </NavItem>
      </div>

      {user?.roleKey === "admin" && (
        <div className="flex flex-col gap-0.5">
          <div className="text-[13px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">{t("nav.adminSection")}</div>
          <NavItem href="/admin/apis" active={pathname === "/admin/apis"}>
            ⚙️ {t("nav.manageApis")}
          </NavItem>
          <NavItem href="/admin/review" active={pathname === "/admin/review"}>
            <span>🛡️</span>
            <span className="flex-1">{t("nav.reviewApplications")}</span>
            {pendingCount > 0 && (
              <span className="text-[13px] font-mono text-teal-strong bg-surface rounded-full px-1.5">{pendingCount}</span>
            )}
          </NavItem>
          <NavItem href="/admin/access" active={pathname === "/admin/access"}>
            🔐 {t("nav.accessControl")}
          </NavItem>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <div className="text-[13px] uppercase tracking-wide text-ink-faint px-2.5 mb-1.5 font-bold">{t("nav.myAccount")}</div>
        <NavItem href="/tokens" active={pathname === "/tokens"}>
          🔑 {t("nav.myTokens")}
        </NavItem>
      </div>

    </aside>
  );
}
